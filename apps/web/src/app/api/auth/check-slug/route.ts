import { NextResponse } from "next/server";
import { isValidSubdomain, sanitizeSubdomain, isReservedSubdomain } from "@printap/shared";
import { getServerSupabase } from "@/lib/server-auth";

/**
 * Finds a guaranteed unique slug for a given base slug.
 * If "apex-prints" is taken, tries "apex-prints-2", "apex-prints-3", etc.
 */
async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const supabase = getServerSupabase();
  let candidate = baseSlug;
  let counter = 1;

  while (counter <= 50) {
    if (isValidSubdomain(candidate)) {
      const { data } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();

      if (!data) {
        return candidate;
      }
    }
    counter += 1;
    candidate = `${baseSlug.slice(0, 58)}-${counter}`;
  }

  // Fallback: append short random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug.slice(0, 57)}-${randomSuffix}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSlug = searchParams.get("slug") || searchParams.get("name") || "";
    const autoAssign = searchParams.get("autoAssign") === "true";
    const sanitized = sanitizeSubdomain(rawSlug);

    if (!sanitized) {
      return NextResponse.json({
        available: false,
        sanitizedSlug: "",
        reason: "Please enter a valid store name.",
      });
    }

    if (!isValidSubdomain(sanitized)) {
      if (autoAssign || isReservedSubdomain(sanitized)) {
        // Find safe alternative
        const safeBase = isReservedSubdomain(sanitized) ? `${sanitized}-shop` : "shop";
        const unique = await resolveUniqueSlug(safeBase);
        return NextResponse.json({
          available: true,
          sanitizedSlug: unique,
          url: `https://${unique}.mellod.in`,
          wasAdjusted: true,
        });
      }

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
      if (autoAssign) {
        const unique = await resolveUniqueSlug(sanitized);
        return NextResponse.json({
          available: true,
          sanitizedSlug: unique,
          url: `https://${unique}.mellod.in`,
          wasAdjusted: true,
        });
      }

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
      wasAdjusted: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to check slug: ${msg}` }, { status: 500 });
  }
}
