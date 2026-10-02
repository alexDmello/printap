import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSupabase, validateEmail } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.reason }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const normalizedEmail = emailCheck.normalizedEmail;
    const supabase = getServerSupabase();

    const { data: shop, error } = await supabase
      .from("shops")
      .select("*")
      .eq("owner_email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("[login] Database error:", error);
      return NextResponse.json({ error: "Authentication system error." }, { status: 500 });
    }

    if (!shop) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
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
