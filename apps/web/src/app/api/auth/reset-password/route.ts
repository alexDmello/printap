import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  getServerSupabase,
  verifyOtpHash,
  validatePasswordStrength,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
      return NextResponse.json({ error: "A valid 6-digit verification code is required." }, { status: 400 });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();

    // Verify OTP atomically
    const { data: otps, error: otpError } = await supabase
      .from("email_otps")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("purpose", "reset_password")
      .eq("consumed", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (otpError || !otps || otps.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired reset code. Please request a new code." },
        { status: 400 }
      );
    }

    const otpRecord = otps[0];
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return NextResponse.json(
        { error: "Too many failed attempts on this code. Please request a new code." },
        { status: 429 }
      );
    }

    const isMatch = verifyOtpHash(otp.trim(), otpRecord.otp_hash);
    if (!isMatch) {
      await supabase
        .from("email_otps")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);
      return NextResponse.json({ error: "Incorrect verification code." }, { status: 400 });
    }

    // Verify shop exists
    const { data: existingShop } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_email", normalizedEmail)
      .maybeSingle();

    if (!existingShop) {
      return NextResponse.json(
        { error: "No shop account found with this email." },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Consume OTP
    await supabase.from("email_otps").update({ consumed: true }).eq("id", otpRecord.id);

    // Update shop password
    const { error: updateError } = await supabase
      .from("shops")
      .update({
        password_hash: passwordHash,
        email_verified: true,
      })
      .eq("id", existingShop.id);

    if (updateError) {
      console.error("[reset-password] Failed to update shop password:", updateError);
      return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reset-password] Handler exception:", msg);
    return NextResponse.json({ error: `Internal server error: ${msg}` }, { status: 500 });
  }
}
