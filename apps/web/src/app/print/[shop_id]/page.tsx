import { getSupabase } from "@printap/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PrintClient from "./print-client";

interface Props {
  params: Promise<{ shop_id: string }>;
}

/**
 * Dynamic metadata for SEO — uses the shop's name.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shop_id } = await params;
  const supabase = getSupabase();
  const { data: shop } = await supabase
    .from("shops")
    .select("name")
    .eq("id", shop_id)
    .single();

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
 * Server component: fetches shop data and enforces the kill-switch.
 */
export default async function PrintPage({ params }: Props) {
  const { shop_id } = await params;

  const supabase = getSupabase();
  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, name, upi_vpa, status")
    .eq("id", shop_id)
    .single();

  if (error || !shop) {
    notFound();
  }

  // Kill-switch: suspended shops can't accept jobs
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
    />
  );
}
