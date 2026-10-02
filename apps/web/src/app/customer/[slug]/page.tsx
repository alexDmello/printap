import { getSupabase, sanitizeSubdomain } from "@printap/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PrintClient from "@/components/customer/print-client";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Resolves a shop strictly by its unique slug or UUID.
 * Never falls back to unrelated shops or loose name matches.
 */
async function fetchShopBySlugOrId(slugOrId: string) {
  const supabase = getSupabase();
  const clean = decodeURIComponent(slugOrId).toLowerCase().trim();

  // 1. Primary: Exact match on unique `slug` (indexed B-tree lookup)
  try {
    const { data: shopBySlug, error: slugErr } = await supabase
      .from("shops")
      .select(
        "id, name, slug, upi_vpa, status, price_bw, price_color, services, platform_fee, gst_percentage, gst_amount, total_charge, is_online"
      )
      .eq("slug", clean)
      .maybeSingle();

    if (shopBySlug && !slugErr) {
      return shopBySlug;
    }
  } catch (err) {
    console.warn("[Customer] Slug query exception:", err);
  }

  // 2. Secondary: Match by UUID (if input is a valid UUID format)
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clean
    );

  if (isUuid) {
    try {
      const { data: shopById, error: idErr } = await supabase
        .from("shops")
        .select(
          "id, name, slug, upi_vpa, status, price_bw, price_color, services, platform_fee, gst_percentage, gst_amount, total_charge, is_online"
        )
        .eq("id", clean)
        .maybeSingle();

      if (shopById && !idErr) {
        return shopById;
      }
    } catch (err) {
      console.warn("[Customer] UUID query exception:", err);
    }
  }

  // 3. Fallback: ONLY for legacy shops where `slug` is null or empty
  // Matches strictly if sanitizeSubdomain(shop.name) === clean
  try {
    const { data: legacyShops, error: legacyErr } = await supabase
      .from("shops")
      .select(
        "id, name, slug, upi_vpa, status, price_bw, price_color, services, platform_fee, gst_percentage, gst_amount, total_charge, is_online"
      )
      .or("slug.is.null,slug.eq.''");

    if (legacyShops && !legacyErr && legacyShops.length > 0) {
      const matched = legacyShops.find(
        (s) => sanitizeSubdomain(s.name) === clean
      );
      if (matched) {
        return matched;
      }
    }
  } catch (err) {
    console.warn("[Customer] Legacy name query exception:", err);
  }

  // If no exact match is found, the shop does NOT exist.
  // Never fall back to another shop!
  return null;
}

/**
 * Dynamic SEO metadata for customer-facing shop subdomain.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await fetchShopBySlugOrId(slug);

  if (!shop) {
    return {
      title: "Shop Not Found — Printap",
      description: "This print shop was not found.",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `Print at ${shop.name} — Printap`,
    description: `Upload a PDF and print instantly at ${shop.name}. No waiting, no cloud storage.`,
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Customer Print Page rendered for {shopname}.mellod.in
 */
export default async function CustomerShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await fetchShopBySlugOrId(slug);

  if (!shop) {
    notFound();
  }

  // Kill-switch: suspended shops cannot accept jobs
  if (shop.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-8 max-w-sm text-center glow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-amber-400 mb-2">
            Shop Temporarily Unavailable
          </h1>
          <p className="text-sm text-[--color-muted]">
            This shop is currently not accepting print requests.
            Please try again later or visit another shop.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrintClient
      shopId={shop.id}
      shopName={shop.name}
      upiVpa={shop.upi_vpa}
      priceBw={shop.price_bw ?? undefined}
      priceColor={shop.price_color ?? undefined}
      services={shop.services ?? undefined}
      initialIsOnline={Boolean(shop.is_online)}
      platformFee={shop.platform_fee ?? undefined}
      gstPercentage={shop.gst_percentage ?? undefined}
      gstAmount={shop.gst_amount ?? undefined}
      totalCharge={shop.total_charge ?? undefined}
    />
  );
}
