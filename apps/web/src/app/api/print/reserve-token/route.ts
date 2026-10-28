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

    // In 100% free tier, token deductions are bypassed; print tickets are issued directly.
    const jwt = await new jose.SignJWT({ shopId, sessionId, totalAmount, paymentMethod })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h") // Ticket is valid for 1 hour
      .sign(getJwtSecret());

    return NextResponse.json({
      success: true,
      printTicket: jwt,
      balance: 999999,
      alert: false,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[reserve-token] Error:", errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
