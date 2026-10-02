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
 * Validates a subdomain label against RFC-1035 DNS specifications.
 * Rules:
 * - Length between 1 and 63 characters
 * - Only lowercase alphanumeric characters and hyphens
 * - Cannot start or end with a hyphen
 */
export function isValidSubdomainLabel(label: string): boolean {
  if (!label || label.length > 63) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

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
 * Reserved subdomains that cannot be used by shops.
 * Covers brand identifiers, financial/auth endpoints, and infrastructure labels.
 * Neither "shop" nor "admin" exist as web destinations because
 * management is strictly handled via Electron Desktop apps.
 */
export const RESERVED_SUBDOMAINS = [
  // Core & Platform
  "www",
  "admin",
  "shop",
  "api",
  "app",
  "dashboard",
  "portal",
  "desktop",
  "counter",
  "platform",
  // Brand Protection
  "mello",
  "mellod",
  "printap",
  // Authentication & Accounts
  "auth",
  "login",
  "signin",
  "signup",
  "register",
  "logout",
  "security",
  "account",
  "accounts",
  "user",
  "users",
  // Financial & Transactions
  "pay",
  "payment",
  "payments",
  "billing",
  "checkout",
  "wallet",
  "upi",
  // Infrastructure & Network
  "mail",
  "ftp",
  "smtp",
  "pop",
  "ns1",
  "ns2",
  "status",
  "health",
  "metrics",
  "cdn",
  "assets",
  "static",
  "ws",
  "rtc",
  "signaling",
  "socket",
  // Environments & Localhost
  "localhost",
  "dev",
  "stage",
  "staging",
  "test",
  "testing",
  "demo",
] as const;

export function isReservedSubdomain(slug: string): boolean {
  if (!slug) return false;
  const lower = slug.toLowerCase().trim();
  return (RESERVED_SUBDOMAINS as readonly string[]).includes(lower);
}

/**
 * Checks both RFC-1035 label validity and that the slug is not a reserved subdomain.
 */
export function isValidSubdomain(slug: string): boolean {
  if (!slug) return false;
  return isValidSubdomainLabel(slug) && !isReservedSubdomain(slug);
}

export type SubdomainType =
  | { type: "marketing" }
  | { type: "customer"; slug: string }
  | { type: "not-found" };

/**
 * Extracts and classifies the subdomain from an HTTP Host header.
 * Handles production domains (mellod.in) as well as development/test hosts.
 *
 * Enforces RFC-1035 label validation and blocks reserved subdomains at the edge.
 */
export function extractSubdomain(hostHeader: string | null | undefined): SubdomainType {
  if (!hostHeader) {
    return { type: "marketing" };
  }

  // Strip port if present (e.g. "my-shop.mellod.in:443") and trailing dots
  const host = hostHeader.split(":")[0].toLowerCase().trim().replace(/\.+$/, "");

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
    // Block reserved subdomains and syntax-invalid labels at the edge
    if (!isValidSubdomainLabel(sub) || isReservedSubdomain(sub)) {
      return { type: "not-found" };
    }
    return { type: "customer", slug: sub };
  }

  // Support local development with custom host headers (e.g. myshop.localhost:3000)
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    if (!sub || sub === "www") {
      return { type: "marketing" };
    }
    if (!isValidSubdomainLabel(sub) || isReservedSubdomain(sub)) {
      return { type: "not-found" };
    }
    return { type: "customer", slug: sub };
  }

  // Fallback
  return { type: "marketing" };
}
