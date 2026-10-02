import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getServerSupabase, generateOtp, hashOtp, validateEmail } from "@/lib/server-auth";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || "Printap <onboarding@resend.dev>";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, purpose } = body;

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.reason }, { status: 400 });
    }

    const normalizedEmail = emailCheck.normalizedEmail;
    const validPurpose = purpose === "reset_password" ? "reset_password" : "onboarding";

    const supabase = getServerSupabase();

    // Check account existence based on purpose
    const { data: existingShop, error: shopCheckError } = await supabase
      .from("shops")
      .select("id, name, owner_email")
      .eq("owner_email", normalizedEmail)
      .maybeSingle();

    if (shopCheckError) {
      console.error("[send-otp] Error querying shops table:", shopCheckError);
    }

    if (validPurpose === "reset_password" && !existingShop) {
      return NextResponse.json(
        { error: "No shop account found with this email address." },
        { status: 404 }
      );
    }

    if (validPurpose === "onboarding" && existingShop) {
      return NextResponse.json(
        { error: "A shop is already registered with this email. Please log in or reset your password." },
        { status: 409 }
      );
    }

    // Rate Limiting: Check if an OTP was issued for this email within the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentOtps } = await supabase
      .from("email_otps")
      .select("id, created_at")
      .eq("email", normalizedEmail)
      .eq("purpose", validPurpose)
      .gte("created_at", sixtySecondsAgo)
      .limit(1);

    if (recentOtps && recentOtps.length > 0) {
      return NextResponse.json(
        { error: "Please wait 60 seconds before requesting a new verification code." },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP & SHA-256 Hash
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store in email_otps table
    const { error: insertError } = await supabase.from("email_otps").insert({
      email: normalizedEmail,
      otp_hash: otpHash,
      purpose: validPurpose,
      expires_at: expiresAt,
      attempts: 0,
      consumed: false,
    });

    if (insertError) {
      console.error("[send-otp] Failed to insert OTP into database:", insertError);
      return NextResponse.json(
        { error: "Failed to create verification session. Please try again." },
        { status: 500 }
      );
    }

    // Email content
    const subject =
      validPurpose === "reset_password"
        ? `${otp} is your Printap password reset code`
        : `${otp} is your Printap shop verification code`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
            .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
            .badge { display: inline-block; background: #ecfdf5; color: #059669; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; letter-spacing: 0.5px; margin-bottom: 20px; }
            h1 { font-size: 24px; font-weight: 800; margin: 0 0 12px 0; color: #0f172a; }
            p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
            .otp-box { background: #0f172a; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; letter-spacing: 10px; font-size: 34px; font-weight: 800; color: #34d399; font-family: monospace; }
            .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">PRINTAP VERIFICATION</div>
            <h1>${validPurpose === "reset_password" ? "Reset your password" : "Verify your shop email"}</h1>
            <p>Use the 6-digit code below to ${
              validPurpose === "reset_password" ? "reset your counter terminal password" : "complete your shop onboarding"
            }. This code will expire in <strong>10 minutes</strong>.</p>
            
            <div class="otp-box">${otp}</div>
            
            <p>If you did not request this verification code, you can safely ignore this email. Never share this code with anyone.</p>
            
            <div class="footer">
              Printap • Zero Cloud Storage • Encrypted Peer-to-Peer Counter Printing<br/>
              mellod.in
            </div>
          </div>
        </body>
      </html>
    `;

    if (resend) {
      try {
        const { error: sendError } = await resend.emails.send({
          from: EMAIL_FROM,
          to: [normalizedEmail],
          subject,
          html: htmlContent,
        });

        if (sendError) {
          console.error("[send-otp] Resend delivery error:", sendError);
          return NextResponse.json(
            { error: `Email delivery failed: ${sendError.message}` },
            { status: 502 }
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[send-otp] Resend unexpected exception:", msg);
        return NextResponse.json(
          { error: `Could not send verification email: ${msg}` },
          { status: 502 }
        );
      }
    } else {
      console.warn(
        `[send-otp] RESEND_API_KEY is not set. Dev fallback OTP for ${normalizedEmail}: >>> ${otp} <<<`
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent successfully.",
      email: normalizedEmail,
      devMode: !resend,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-otp] Handler error:", msg);
    return NextResponse.json({ error: `Internal server error: ${msg}` }, { status: 500 });
  }
}
