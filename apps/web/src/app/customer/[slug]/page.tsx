import { getSupabase, sanitizeSubdomain } from "@printap/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PrintClient from "@/components/customer/print-client";
import ShopOffline from "@/components/customer/ShopOffline";

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchShopBySlugOrId(slugOrId: string) {
  const supabase = getSupabase();
  const clean = decodeURIComponent(slugOrId).toLowerCase().trim();

  // 1. Try finding by slug first (resilient select *)
  try {
    const { data: shopBySlug, error: slugErr } = await supabase
      .from("shops")
      .select("*")
      .eq("slug", clean)
      .maybeSingle();

    if (shopBySlug && !slugErr) {
      return shopBySlug;
    }
  } catch (err) {
    console.warn("[Customer] Slug query exception:", err);
  }

  // 2. If not found by slug, check if input is a valid UUID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clean
    );

  if (isUuid) {
    try {
      const { data: shopById, error: idErr } = await supabase
        .from("shops")
        .select("*")
        .eq("id", clean)
        .maybeSingle();

      if (shopById && !idErr) {
        return shopById;
      }
    } catch (err) {
      console.warn("[Customer] UUID query exception:", err);
    }
  }

  // 3. Fallback: match by sanitized shop name (e.g. "My Test Shop" -> "my-test-shop")
  try {
    const { data: allShops } = await supabase
      .from("shops")
      .select("*")
      .eq("status", "active");

    if (allShops && allShops.length > 0) {
      // Find shop whose sanitized name matches `clean`
      const matched = allShops.find((s) => sanitizeSubdomain(s.name) === clean);
      if (matched) {
        return matched;
      }

      // If there is only one active shop on the platform, fall back to it
      // so customers scanning a counter QR never get stranded on a 404
      if (allShops.length === 1) {
        return allShops[0];
      }
    }
  } catch (err) {
    console.warn("[Customer] Fallback name query exception:", err);
  }

  return null;
}

/**
 * Dynamic SEO metadata for customer-facing shop subdomain.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await fetchShopBySlugOrId(slug);

  return {
    title: shop
      ? `Print at ${shop.name} — Printap`
      : "Shop Not Found — Printap",
    description: shop
      ? `Upload a PDF and print instantly at ${shop.name}. No waiting, no cloud storage.`
      : "This print shop was not found.",
  };
}

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

  // Presence check: shop desktop terminal must be online to accept orders
  if (!shop.is_online) {
    return <ShopOffline shopId={shop.id} shopName={shop.name} />;
  }

  return (
    <PrintClient
      shopId={shop.id}
      shopName={shop.name}
      upiVpa={shop.upi_vpa}
      priceBw={shop.price_bw ?? undefined}
      priceColor={shop.price_color ?? undefined}
      services={shop.services ?? undefined}
    />
  );
}
