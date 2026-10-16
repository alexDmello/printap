import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/server-auth";
import { getJwtSecret } from "@/lib/env";
import * as jose from "jose";

export async function POST(req: NextRequest) {
  try {
    const { shopId, sessionId, totalAmount, paymentMethod } = await req.json();

    if (!shopId || !sessionId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // 1. Reserve the token via RPC
    const { data, error } = await supabase.rpc("reserve_shop_token", {
      p_shop_id: shopId,
      p_session_id: sessionId,
    });

    if (error || !data || !data.success) {
      console.error("[reserve-token] Failed to reserve:", error || data?.error);
      return NextResponse.json(
        { success: false, error: data?.error || error?.message || "Failed to reserve token" },
        { status: 400 }
      );
    }

    // 2. Generate a cryptographically signed Print Ticket
    const jwt = await new jose.SignJWT({ shopId, sessionId, totalAmount, paymentMethod })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h") // Ticket is valid for 1 hour
      .sign(getJwtSecret());

    return NextResponse.json({
      success: true,
      printTicket: jwt,
      balance: data.balance,
      alert: data.alert,
    });
  } catch (error) {
    console.error("[reserve-token] Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
