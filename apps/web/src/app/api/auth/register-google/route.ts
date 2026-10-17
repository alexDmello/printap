import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isValidSubdomain, sanitizeSubdomain, validateEmail } from "@printap/shared";
import { getServerSupabase, validatePasswordStrength } from "@/lib/server-auth";

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
    } = body;

    // 1. Validate required fields
    if (!shopName || typeof shopName !== "string" || !shopName.trim()) {
      return NextResponse.json({ error: "Shop name is required." }, { status: 400 });
    }

    if (!ownerEmail || typeof ownerEmail !== "string") {
      return NextResponse.json({ error: "Verified Google email is required." }, { status: 400 });
    }

    const normalizedEmail = ownerEmail.trim().toLowerCase();
    const emailCheck = validateEmail(normalizedEmail);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || "Invalid email address format." },
        { status: 400 }
      );
    }

    // Validate session token if provided (10-minute maximum retention limit)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const supabaseAuth = getServerSupabase();
      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser(token);

      if (userError || !user) {
        return NextResponse.json(
          { error: "Your login session is invalid or has expired. Please sign in again." },
          { status: 401 }
        );
      }

      if (user.last_sign_in_at) {
        const lastSignInTime = new Date(user.last_sign_in_at).getTime();
        const MAX_SESSION_AGE_MS = 10 * 60 * 1000;
        if (Date.now() - lastSignInTime > MAX_SESSION_AGE_MS) {
          return NextResponse.json(
            { error: "Your onboarding login session has expired (10-minute limit). Please sign in again." },
            { status: 401 }
          );
        }
      }
    }

    // 2. Validate counter terminal password
    const pwdStrength = validatePasswordStrength(password || "");
    if (!pwdStrength.valid) {
      return NextResponse.json(
        { error: pwdStrength.reason || "Invalid terminal password." },
        { status: 400 }
      );
    }

    // 3. Validate UPI ID
    if (!upiVpa || !upiVpa.includes("@") || upiVpa.trim().startsWith("@") || upiVpa.trim().endsWith("@")) {
      return NextResponse.json(
        { error: "A valid UPI VPA ID (e.g. name@bank) is required for customer payments." },
        { status: 400 }
      );
    }

    // 4. Sanitize and derive slug
    const targetSlug = sanitizeSubdomain(slug || shopName);
    if (!isValidSubdomain(targetSlug)) {
      return NextResponse.json(
        { error: "Generated subdomain handle is invalid." },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // 5. Ensure owner email is not already registered
    const { data: existingOwner } = await supabase
      .from("shops")
      .select("id, slug")
      .eq("owner_email", normalizedEmail)
      .maybeSingle();

    if (existingOwner) {
      return NextResponse.json(
        {
          error: "An account with this Google email already exists.",
          existingSlug: existingOwner.slug,
        },
        { status: 409 }
      );
    }

    // 6. Guarantee unique slug with automatic collision resolution (-2, -3, etc.)
    let finalSlug = targetSlug;
    const { data: existingSlug } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", targetSlug)
      .maybeSingle();

    if (existingSlug) {
      let counter = 2;
      while (counter <= 50) {
        const candidate = `${targetSlug.slice(0, 58)}-${counter}`;
        const { data: candidateExists } = await supabase
          .from("shops")
          .select("id")
          .eq("slug", candidate)
          .maybeSingle();
        if (!candidateExists) {
          finalSlug = candidate;
          break;
        }
        counter += 1;
      }
      if (finalSlug === targetSlug) {
        finalSlug = `${targetSlug.slice(0, 57)}-${Math.random().toString(36).substring(2, 6)}`;
      }
    }

    // 7. Hash counter terminal password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 8. Provision shop in database
    const { data: newShop, error: insertError } = await supabase
      .from("shops")
      .insert({
        name: shopName.trim(),
        slug: finalSlug,
        owner_name: (ownerName || "").trim(),
        owner_email: normalizedEmail,
        owner_phone: (ownerPhone || "").trim() || null,
        password_hash: hashedPassword,
        email_verified: true, // Verified by Google OAuth
        upi_vpa: upiVpa.trim(),
        latitude: typeof latitude === "number" ? latitude : null,
        longitude: typeof longitude === "number" ? longitude : null,
        address: address ? address.trim() : null,
        city: city ? city.trim() : null,
        state: state ? state.trim() : null,
        pincode: pincode ? pincode.trim() : null,
        status: "active",
      })
      .select("id, name, slug, owner_name, owner_email, upi_vpa")
      .single();

    if (insertError) {
      console.error("[RegisterGoogle Insert Error]:", insertError);
      return NextResponse.json(
        { error: "Failed to create shop account: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      shop: newShop,
      message: "Shop registered successfully with Google OAuth!",
    });
  } catch (error) {
    console.error("[RegisterGoogle Route Error]:", error);
    return NextResponse.json(
      { error: "Internal server error during Google registration." },
      { status: 500 }
    );
  }
}
