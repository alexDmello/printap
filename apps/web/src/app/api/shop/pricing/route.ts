import { NextResponse } from "next/server";
import { getSupabase } from "@printap/shared";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    return NextResponse.json({
      success: true,
      platformSettings: data || {
        id: "global",
        platform_fee: 0.82,
        gst_percentage: 18.0,
        gst_amount: 0.18,
        total_charge: 1.0,
      },
    });
  } catch (err) {
    return NextResponse.json({
      success: true,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      shopId,
      priceBw,
      priceColor,
      services,
      platformFee,
      gstPercentage,
      gstAmount,
      totalCharge,
    } = body;

    if (!shopId) {
      return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
    }

    const supabase = getSupabase();
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update global platform_settings table if platform fee or GST was provided
    if (typeof platformFee === "number" && typeof gstPercentage === "number") {
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

    return NextResponse.json({ success: true, shop: data });
  } catch (err) {
    console.error("[API pricing] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
