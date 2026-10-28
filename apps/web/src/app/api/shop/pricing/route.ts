import { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/server-auth";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";
import { z } from "zod";

const pricingUpdateSchema = z.object({
  shopId: z.string().uuid("Invalid shop ID format"),
  priceBw: z.number().min(0).max(1000).optional(),
  priceColor: z.number().min(0).max(1000).optional(),
  services: z.array(z.any()).optional(),
});

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

    const { shopId, priceBw, priceColor, services } = parseResult.data;

    const supabase = getServerSupabase();
    const updatePayload: Record<string, unknown> = {};

    if (typeof priceBw === "number") updatePayload.price_bw = priceBw;
    if (typeof priceColor === "number") updatePayload.price_color = priceColor;
    if (Array.isArray(services)) updatePayload.services = services;

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

    return apiSuccess({ shop: data });
  } catch (err) {
    return apiServerError(err, "API pricing");
  }
}
