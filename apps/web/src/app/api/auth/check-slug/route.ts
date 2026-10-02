import { NextResponse } from "next/server";
import { isValidSubdomain, sanitizeSubdomain, isReservedSubdomain } from "@printap/shared";
import { getServerSupabase } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSlug = searchParams.get("slug") || "";
    const sanitized = sanitizeSubdomain(rawSlug);

    if (!sanitized) {
      return NextResponse.json({
        available: false,
        sanitizedSlug: "",
        reason: "Please enter a valid subdomain name.",
      });
    }

    if (!isValidSubdomain(sanitized)) {
      return NextResponse.json({
        available: false,
        sanitizedSlug: sanitized,
        reason: isReservedSubdomain(sanitized)
          ? `Subdomain "${sanitized}" is reserved by Printap.`
          : `Subdomain "${sanitized}" must be 3-63 lowercase alphanumeric characters.`,
      });
    }

    const supabase = getServerSupabase();
    const { data: existing } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", sanitized)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        available: false,
        sanitizedSlug: sanitized,
        reason: `Subdomain "${sanitized}.mellod.in" is already taken.`,
      });
    }

    return NextResponse.json({
      available: true,
      sanitizedSlug: sanitized,
      url: `https://${sanitized}.mellod.in`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to check slug: ${msg}` }, { status: 500 });
  }
}
