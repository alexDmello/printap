import { getSupabase } from "@printap/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PrintClient from "@/components/customer/print-client";

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchShopBySlugOrId(slugOrId: string) {
  const supabase = getSupabase();
  const clean = decodeURIComponent(slugOrId).toLowerCase().trim();

  // 1. Try finding by slug first
  const { data: shopBySlug } = await supabase
    .from("shops")
    .select("id, name, upi_vpa, status, slug, price_bw, price_color")
    .eq("slug", clean)
    .maybeSingle();

  if (shopBySlug) {
    return shopBySlug;
  }

  // 2. If not found by slug, check if input is a valid UUID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clean
    );

  if (isUuid) {
    const { data: shopById } = await supabase
      .from("shops")
      .select("id, name, upi_vpa, status, slug, price_bw, price_color")
      .eq("id", clean)
      .maybeSingle();

    if (shopById) {
      return shopById;
    }
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

  return (
    <PrintClient
      shopId={shop.id}
      shopName={shop.name}
      upiVpa={shop.upi_vpa}
      priceBw={shop.price_bw ?? undefined}
      priceColor={shop.price_color ?? undefined}
    />
  );
}
