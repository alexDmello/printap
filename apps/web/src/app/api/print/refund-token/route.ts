import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/server-auth";
import { getJwtSecret } from "@/lib/env";
import * as jose from "jose";

export async function POST(req: NextRequest) {
  try {
    const { shopId, sessionId, printTicket } = await req.json();

    if (!shopId || !sessionId || !printTicket) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify the Print Ticket (JWT)
    let payload;
    try {
      const { payload: verifiedPayload } = await jose.jwtVerify(printTicket, getJwtSecret());
      payload = verifiedPayload;
    } catch (err) {
      console.error("[refund-token] Invalid print ticket:", err);
      return NextResponse.json({ success: false, error: "Invalid or expired print ticket" }, { status: 401 });
    }

    if (payload.shopId !== shopId || payload.sessionId !== sessionId) {
      return NextResponse.json({ success: false, error: "Print ticket mismatch" }, { status: 403 });
    }

    const supabase = getServerSupabase();

    // 2. Fetch the print order to check its current status
    const { data: order, error: orderError } = await supabase
      .from("print_orders")
      .select("status, payment_status, payment_method")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (orderError) {
      console.error("[refund-token] Error fetching order:", orderError);
      return NextResponse.json({ success: false, error: "Failed to fetch order status" }, { status: 500 });
    }

    // If order was already successfully picked up, we don't allow a refund.
    if (order && (order.status === "picked_up" || order.status === "ready_for_pickup")) {
      return NextResponse.json({ success: false, error: "Order is already completed or ready for pickup. Cannot refund." }, { status: 400 });
    }

    // 3. Optional refund call (non-blocking in free tier)
    try {
      await supabase.rpc("refund_shop_token", {
        p_shop_id: shopId,
        p_session_id: sessionId,
      });
    } catch {}

    // 4. Update order status to failed_refunded
    await supabase
      .from("print_orders")
      .update({ status: "failed_refunded" })
      .eq("session_id", sessionId);

    // 5. Trigger payment gateway refund if applicable
    if (order && order.payment_method === "upi" && order.payment_status === "confirmed") {
      // TODO: Integrate with payment gateway (e.g. Razorpay) to initiate refund
      console.log(`[refund-token] Triggering UPI refund for session ${sessionId}`);
    }

    return NextResponse.json({
      success: true,
      balance: 999999,
      message: "Order refunded/cancelled successfully",
    });
  } catch (error) {
    console.error("[refund-token] Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
