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
export function getCustomerPrintUrl(slugOrId: string): string {
  const clean = sanitizeSubdomain(slugOrId);
  return `https://${clean}.${ROOT_DOMAIN}`;
}

export type SubdomainType =
  | { type: "marketing" }
  | { type: "shop-admin" }
  | { type: "platform-admin" }
  | { type: "customer"; slug: string };

/**
 * Extracts and classifies the subdomain from an HTTP Host header.
 * Handles production domains (mellod.in) as well as development/test hosts.
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
      return { type: "shop-admin" };
    }
    if (sub === PLATFORM_ADMIN_SUBDOMAIN) {
      return { type: "platform-admin" };
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
      return { type: "shop-admin" };
    }
    if (sub === PLATFORM_ADMIN_SUBDOMAIN) {
      return { type: "platform-admin" };
    }
    return { type: "customer", slug: sub };
  }

  // Fallback
  return { type: "marketing" };
}
