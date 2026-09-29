import { getSupabase, getShopCustomerUrl } from "@printap/shared";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ shop_id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Redirecting to Counter... — Printap",
  };
}

/**
 * Legacy path handler for /print/[shop_id].
 * Permanently redirects customers to the canonical shop subdomain:
 * https://{shop_name_or_slug}.mellod.in
 */
export default async function LegacyPrintPage({ params }: Props) {
  const { shop_id } = await params;
  const supabase = getSupabase();
  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, name, slug")
    .eq("id", shop_id)
    .maybeSingle();

  if (error || !shop) {
    notFound();
  }

  // Permanent 308 redirect to the dedicated shop name subdomain (never UID)
  const targetSubdomainUrl = getShopCustomerUrl(shop);
  redirect(targetSubdomainUrl);
}
