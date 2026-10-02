import { NextResponse } from "next/server";
import { getServerSupabase, verifyOtpHash } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp, purpose } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
      return NextResponse.json({ error: "Please enter a valid 6-digit code." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const validPurpose = purpose === "reset_password" ? "reset_password" : "onboarding";

    const supabase = getServerSupabase();

    // Fetch the latest unconsumed, unexpired OTP for this email & purpose
    const nowIso = new Date().toISOString();
    const { data: records, error } = await supabase
      .from("email_otps")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("purpose", validPurpose)
      .eq("consumed", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !records || records.length === 0) {
      return NextResponse.json(
        { error: "The verification code is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const otpRecord = records[0];

    // Check attempt lockout
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return NextResponse.json(
        { error: "Too many failed attempts. This code is locked. Please request a new one." },
        { status: 429 }
      );
    }

    // Verify hash with constant-time equality
    const isValid = verifyOtpHash(cleanOtp, otpRecord.otp_hash);

    if (!isValid) {
      const nextAttempts = otpRecord.attempts + 1;
      await supabase
        .from("email_otps")
        .update({ attempts: nextAttempts })
        .eq("id", otpRecord.id);

      const remaining = Math.max(0, otpRecord.max_attempts - nextAttempts);
      return NextResponse.json(
        {
          error: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          remainingAttempts: remaining,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code confirmed.",
      email: normalizedEmail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verify-otp] Handler error:", msg);
    return NextResponse.json({ error: `Internal server error: ${msg}` }, { status: 500 });
  }
}
