/**
 * Domain and Subdomain Routing Configurations for Printap.
 * Canonical Root Domain: mellod.in
 */

export const ROOT_DOMAIN = "mellod.in";
export const SHOP_ADMIN_SUBDOMAIN = "shop";
export const PLATFORM_ADMIN_SUBDOMAIN = "admin";

/**
 * Public marketing & landing page URL
 */
export const MARKETING_URL = `https://www.${ROOT_DOMAIN}`;

/**
 * Shop owner web administration portal URL
 */
export const SHOP_ADMIN_URL = `https://${SHOP_ADMIN_SUBDOMAIN}.${ROOT_DOMAIN}`;

/**
 * Platform operator administration portal URL
 */
export const PLATFORM_ADMIN_URL = `https://${PLATFORM_ADMIN_SUBDOMAIN}.${ROOT_DOMAIN}`;

/**
 * Sanitizes an input string to be a valid DNS subdomain label.
 * Rules: lowercase, alphanumeric and hyphen only, no leading/trailing hyphens, max 63 chars.
 */
export function sanitizeSubdomain(input: string): string {
  if (!input) return "shop";
  const sanitized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return sanitized || "shop";
}

/**
 * Computes the customer print URL for a specific shop.
 * Example: "rahuls-xerox" -> "https://rahuls-xerox.mellod.in"
 */
export function getCustomerPrintUrl(slugOrName: string): string {
  const clean = sanitizeSubdomain(slugOrName);
  return `https://${clean}.${ROOT_DOMAIN}`;
}

/**
 * Computes the canonical customer print URL from a shop object.
 * Guaranteed to use the shop name or slug — never the raw UID!
 * Priority:
 *   1. shop.slug (if present)
 *   2. sanitizeSubdomain(shop.name) (if present)
 *   3. fallbackName (if provided)
 */
export function getShopCustomerUrl(
  shop?: { slug?: string | null; name?: string | null; id?: string } | null,
  fallbackName?: string
): string {
  if (shop?.slug && shop.slug.trim()) {
    return getCustomerPrintUrl(shop.slug);
  }
  if (shop?.name && shop.name.trim()) {
    return getCustomerPrintUrl(shop.name);
  }
  if (fallbackName && fallbackName.trim()) {
    return getCustomerPrintUrl(fallbackName);
  }
  return `https://counter.${ROOT_DOMAIN}`;
}

/**
 * Reserved subdomains that cannot be used by shop counters.
 * "shop" and "admin" are explicitly retired from browser routing
 * as shop and platform management are strictly controlled via Electron Desktop apps.
 */
export const RESERVED_SUBDOMAINS = [
  "www",
  "admin",
  "shop",
  "api",
  "app",
  "dashboard",
  "portal",
  "desktop",
  "counter",
  "mail",
  "ftp",
  "localhost",
] as const;

export function isReservedSubdomain(slug: string): boolean {
  if (!slug) return false;
  const lower = slug.toLowerCase().trim();
  return RESERVED_SUBDOMAINS.includes(lower as any);
}

export type SubdomainType =
  | { type: "marketing" }
  | { type: "blocked-admin"; target: "shop" | "platform" }
  | { type: "customer"; slug: string };

/**
 * Extracts and classifies the subdomain from an HTTP Host header.
 * Handles production domains (mellod.in) as well as development/test hosts.
 *
 * NOTE: Both shop and platform administration domains (shop.mellod.in & admin.mellod.in)
 * are blocked from browser access and classify as "blocked-admin" so the Edge middleware
 * can display the desktop-only security notice.
 */
export function extractSubdomain(hostHeader: string | null | undefined): SubdomainType {
  if (!hostHeader) {
    return { type: "marketing" };
  }

  // Strip port if present (e.g. "shop.mellod.in:443" or "rahul.localhost:3000")
  const host = hostHeader.split(":")[0].toLowerCase().trim();

  // Root or www -> Marketing
  if (
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === "localhost" ||
    host === "127.0.0.1"
  ) {
    return { type: "marketing" };
  }

  // Check mellod.in subdomains
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    if (!sub || sub === "www") {
      return { type: "marketing" };
    }
    if (sub === SHOP_ADMIN_SUBDOMAIN) {
      return { type: "blocked-admin", target: "shop" };
    }
    if (sub === PLATFORM_ADMIN_SUBDOMAIN) {
      return { type: "blocked-admin", target: "platform" };
    }
    return { type: "customer", slug: sub };
  }

  // Support local development with custom host headers (e.g. shop.localhost, admin.localhost, myshop.localhost)
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    if (!sub || sub === "www") {
      return { type: "marketing" };
    }
    if (sub === SHOP_ADMIN_SUBDOMAIN) {
      return { type: "blocked-admin", target: "shop" };
    }
    if (sub === PLATFORM_ADMIN_SUBDOMAIN) {
      return { type: "blocked-admin", target: "platform" };
    }
    return { type: "customer", slug: sub };
  }

  // Fallback
  return { type: "marketing" };
}
