import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSupabase, validateEmail } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawIdentifier = (body.email || body.identifier || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    if (!rawIdentifier) {
      return NextResponse.json({ error: "Email or shop subdomain handle is required." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const cleanIdentifier = rawIdentifier.toLowerCase();
    const supabase = getServerSupabase();

    let query = supabase.from("shops").select("*");
    if (cleanIdentifier.includes("@")) {
      const emailCheck = validateEmail(cleanIdentifier);
      if (!emailCheck.valid) {
        return NextResponse.json({ error: emailCheck.reason }, { status: 400 });
      }
      query = query.ilike("owner_email", emailCheck.normalizedEmail);
    } else {
      query = query.eq("slug", cleanIdentifier);
    }

    const { data: shop, error } = await query.maybeSingle();

    if (error) {
      console.error("[login] Database error:", error);
      return NextResponse.json({ error: "Authentication system error." }, { status: 500 });
    }

    if (!shop) {
      if (cleanIdentifier.includes("@")) {
        return NextResponse.json(
          {
            error: "No registered shop found for this email. Redirecting to onboarding...",
            unregistered: true,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: "Invalid shop handle or password." }, { status: 401 });
    }

    if (shop.status === "suspended") {
      return NextResponse.json(
        { error: "This shop account has been suspended. Please contact support." },
        { status: 403 }
      );
    }

    if (!shop.password_hash) {
      return NextResponse.json(
        {
          error:
            "This shop does not have a password configured yet. Please click 'Forgot Password' to set your terminal password with email verification.",
        },
        { status: 400 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, shop.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Omit sensitive password_hash before returning
    const { password_hash: _, ...safeShop } = shop;

    return NextResponse.json({
      success: true,
      shop: safeShop,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[login] Handler exception:", msg);
    return NextResponse.json({ error: `Internal server error: ${msg}` }, { status: 500 });
  }
}
