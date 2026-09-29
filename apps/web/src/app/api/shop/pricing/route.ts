import { NextResponse } from "next/server";
import { getSupabase } from "@printap/shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shopId, priceBw, priceColor, services } = body;

    if (!shopId) {
      return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
    }

    const supabase = getSupabase();
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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
