import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isValidSubdomain, sanitizeSubdomain } from "@printap/shared";
import {
  getServerSupabase,
  verifyOtpHash,
  validatePasswordStrength,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      shopName,
      slug,
      ownerName,
      ownerEmail,
      ownerPhone,
      password,
      upiVpa,
      latitude,
      longitude,
      address,
      city,
      state,
      pincode,
      otp,
    } = body;

    // Validate required fields
    if (!shopName || typeof shopName !== "string" || !shopName.trim()) {
      return NextResponse.json({ error: "Shop name is required." }, { status: 400 });
    }
    if (!ownerName || typeof ownerName !== "string" || !ownerName.trim()) {
      return NextResponse.json({ error: "Owner name is required." }, { status: 400 });
    }
    if (!ownerEmail || typeof ownerEmail !== "string" || !ownerEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    if (!upiVpa || typeof upiVpa !== "string" || !upiVpa.includes("@")) {
      return NextResponse.json(
        { error: "A valid UPI ID (e.g. yourname@okaxis) is required to receive customer payments." },
        { status: 400 }
      );
    }

    const normalizedEmail = ownerEmail.trim().toLowerCase();
    const cleanShopName = shopName.trim();
    const cleanOwnerName = ownerName.trim();
    const cleanPhone = (ownerPhone || "").trim();
    const cleanUpi = upiVpa.trim();

    // Validate Subdomain / Slug
    const targetSlug = sanitizeSubdomain(slug || cleanShopName);
    if (!isValidSubdomain(targetSlug)) {
      return NextResponse.json(
        {
          error: `Subdomain "${targetSlug}" is invalid or reserved. Please choose a different slug (3-63 lowercase alphanumeric characters).`,
        },
        { status: 400 }
      );
    }

    // Validate Password Strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.reason }, { status: 400 });
    }

    // Verify OTP atomically
    if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
      return NextResponse.json({ error: "A valid 6-digit email OTP is required." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();

    const { data: otps, error: otpError } = await supabase
      .from("email_otps")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("purpose", "onboarding")
      .eq("consumed", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (otpError || !otps || otps.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired verification code. Please request a new code." },
        { status: 400 }
      );
    }

    const otpRecord = otps[0];
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return NextResponse.json(
        { error: "Too many failed attempts on this code. Please request a new one." },
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

    // Check if Slug is already registered
    const { data: existingSlug } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", targetSlug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json(
        { error: `The subdomain "${targetSlug}.mellod.in" is already taken. Please choose another.` },
        { status: 409 }
      );
    }

    // Check if Email is already registered
    const { data: existingEmail } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_email", normalizedEmail)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Consume OTP
    await supabase.from("email_otps").update({ consumed: true }).eq("id", otpRecord.id);

    // Insert new shop
    const newShopData = {
      name: cleanShopName,
      slug: targetSlug,
      owner_name: cleanOwnerName,
      owner_email: normalizedEmail,
      owner_phone: cleanPhone,
      password_hash: passwordHash,
      email_verified: true,
      upi_vpa: cleanUpi,
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      address: address ? String(address).trim() : null,
      city: city ? String(city).trim() : null,
      state: state ? String(state).trim() : null,
      pincode: pincode ? String(pincode).trim() : null,
      status: "active",
      is_online: false,
      price_bw: 2.0,
      price_color: 10.0,
    };

    const { data: createdShop, error: insertError } = await supabase
      .from("shops")
      .insert(newShopData)
      .select(
        "id, name, slug, owner_name, owner_email, owner_phone, upi_vpa, latitude, longitude, address, city, state, pincode, status, is_online, created_at"
      )
      .single();

    if (insertError || !createdShop) {
      console.error("[register] Failed to insert shop:", insertError);
      return NextResponse.json(
        { error: `Failed to create shop account: ${insertError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Shop onboarding complete!",
      shop: createdShop,
      subdomainUrl: `https://${createdShop.slug}.mellod.in`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[register] Handler exception:", msg);
    return NextResponse.json({ error: `Internal server error: ${msg}` }, { status: 500 });
  }
}
