import { NextRequest } from "next/server";
import { getSupabase } from "@printap/shared";
import { getServerSupabase } from "@/lib/server-auth";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api-response";
import { z } from "zod";

const pricingUpdateSchema = z.object({
  shopId: z.string().uuid("Invalid shop ID format"),
  adminSecret: z.string().optional(),
  priceBw: z.number().min(0).max(1000).optional(),
  priceColor: z.number().min(0).max(1000).optional(),
  services: z.array(z.any()).optional(),
  platformFee: z.number().min(0).max(1000).optional(),
  gstPercentage: z.number().min(0).max(100).optional(),
  gstAmount: z.number().min(0).optional(),
  totalCharge: z.number().min(0).optional(),
});

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    return apiSuccess({
      platformSettings: data || {
        id: "global",
        platform_fee: 0.82,
        gst_percentage: 18.0,
        gst_amount: 0.18,
        total_charge: 1.0,
      },
    });
  } catch (err) {
    return apiSuccess({
      platformSettings: {
        id: "global",
        platform_fee: 0.82,
        gst_percentage: 18.0,
        gst_amount: 0.18,
        total_charge: 1.0,
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const parseResult = pricingUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "Validation error",
        400,
        "VALIDATION_ERROR",
        parseResult.error.flatten().fieldErrors
      );
    }

    const {
      shopId,
      adminSecret,
      priceBw,
      priceColor,
      services,
      platformFee,
      gstPercentage,
      gstAmount,
      totalCharge,
    } = parseResult.data;

    // Security Verification:
    // Global platform fee modifications or cross-shop pricing updates must provide ADMIN_SECRET
    const configuredAdminSecret = process.env.PRINTAP_ADMIN_SECRET;
    const headerSecret = request.headers.get("x-admin-secret");
    const providedSecret = adminSecret || headerSecret;

    // If attempting to modify global platform_settings, require verified admin secret
    const isGlobalUpdate = typeof platformFee === "number" || typeof gstPercentage === "number";
    if (isGlobalUpdate) {
      if (!configuredAdminSecret || providedSecret !== configuredAdminSecret) {
        return apiUnauthorized(
          "Admin privileges required to modify platform fee or system settings",
          "ADMIN_AUTH_REQUIRED"
        );
      }
    }

    const supabase = getServerSupabase();
    const updatePayload: Record<string, unknown> = {};

    if (typeof priceBw === "number") updatePayload.price_bw = priceBw;
    if (typeof priceColor === "number") updatePayload.price_color = priceColor;
    if (Array.isArray(services)) updatePayload.services = services;
    if (typeof platformFee === "number") updatePayload.platform_fee = platformFee;
    if (typeof gstPercentage === "number") updatePayload.gst_percentage = gstPercentage;
    if (typeof gstAmount === "number") updatePayload.gst_amount = gstAmount;
    if (typeof totalCharge === "number") updatePayload.total_charge = totalCharge;

    const { data, error } = await supabase
      .from("shops")
      .update(updatePayload)
      .eq("id", shopId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[API pricing] Supabase error:", error);
      return apiError("Failed to update shop pricing", 500, "DB_ERROR");
    }

    // Update global platform_settings table if platform fee or GST was provided and admin secret was verified
    if (isGlobalUpdate && typeof platformFee === "number" && typeof gstPercentage === "number") {
      try {
        const computedGst =
          typeof gstAmount === "number"
            ? gstAmount
            : Number((platformFee * (gstPercentage / 100)).toFixed(2));
        const computedTotal =
          typeof totalCharge === "number"
            ? totalCharge
            : Number((platformFee + computedGst).toFixed(2));

        await supabase.from("platform_settings").upsert({
          id: "global",
          platform_fee: platformFee,
          gst_percentage: gstPercentage,
          gst_amount: computedGst,
          total_charge: computedTotal,
          updated_at: new Date().toISOString(),
        });
      } catch (psErr) {
        console.warn("[API pricing] Could not update platform_settings:", psErr);
      }
    }

    return apiSuccess({ shop: data });
  } catch (err) {
    return apiServerError(err, "API pricing");
  }
}
