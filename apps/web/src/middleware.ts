import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  extractSubdomain,
  isLocalOrPrivateHost,
  ROOT_DOMAIN,
  MARKETING_URL,
} from "@printap/shared";

/**
 * Builds canonical URL for a shop's dedicated customer counter.
 */
function getCanonicalShopUrl(slug: string, host: string): string {
  const cleanSlug = encodeURIComponent(slug.toLowerCase().trim());
  if (isLocalOrPrivateHost(host)) {
    const portPart = host.split(":")[1] ? `:${host.split(":")[1]}` : "";
    const cleanHost = host.split(":")[0].toLowerCase().trim();
    if (cleanHost === "localhost" || cleanHost.endsWith(".localhost")) {
      return `http://${cleanSlug}.localhost${portPart}`;
    }
    return `http://${cleanHost}${portPart}/customer/${cleanSlug}`;
  }
  return `https://${cleanSlug}.${ROOT_DOMAIN}`;
}

/**
 * Next.js Edge Middleware for Subdomain-based Routing on mellod.in:
 * - Strict subdomain isolation: each shop is ONLY accessible on {shop.slug}.mellod.in
 * - Reserved & invalid subdomains terminate immediately with empty 404 at the edge
 * - Direct /customer/:slug paths on marketing domain or other subdomains 308-redirect to canonical host
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, Next internals, api endpoints, and files with extensions
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const rawHost = request.headers.get("host") || "";
  const host = rawHost.split(":")[0].toLowerCase().trim().replace(/\.+$/, "");
  const sub = extractSubdomain(rawHost);

  // 0. Apex domain canonicalization: mellod.in -> www.mellod.in
  if (!isLocalOrPrivateHost(rawHost) && host === ROOT_DOMAIN) {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, MARKETING_URL);
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // 1. Reserved, brand, or invalid subdomains (e.g. mello, shop, admin, api)
  // Terminate immediately with empty 404 at the edge (zero database queries)
  if (sub.type === "not-found") {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Legacy admin routes or decommissioned paths do not exist — return 404
  if (
    pathname.startsWith("/shop-admin") ||
    pathname.startsWith("/platform-admin") ||
    pathname.startsWith("/desktop-required") ||
    pathname === "/admin" ||
    pathname === "/shop"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // 3. Prevent customer counter from running directly on marketing root (www / root)
  // 308 redirect to the shop's designated canonical subdomain
  if (sub.type === "marketing") {
    if (pathname.startsWith("/customer/")) {
      // If accessed via local private IP or localhost (e.g. local Wi-Fi counter mode),
      // allow direct access to /customer/:slug without redirecting to mellod.in!
      if (isLocalOrPrivateHost(rawHost)) {
        return NextResponse.next();
      }
      const targetSlug = pathname.replace(/^\/customer\/?/, "").split("/")[0];
      if (targetSlug) {
        return NextResponse.redirect(getCanonicalShopUrl(targetSlug, rawHost), 308);
      }
    }
    return NextResponse.next();
  }

  // 4. Customer Subdomain Isolation: {shop_slug}.mellod.in
  if (sub.type === "customer") {
    // Redirect onboarding, auth callback, and download flows to main marketing domain
    if (
      pathname === "/onboard" ||
      pathname.startsWith("/onboard/") ||
      pathname === "/download" ||
      pathname.startsWith("/download/") ||
      pathname.startsWith("/auth/")
    ) {
      return NextResponse.redirect(new URL(pathname + request.nextUrl.search, MARKETING_URL), 308);
    }

    // If a request targets /customer/:other_slug on the wrong subdomain, redirect to canonical
    if (pathname.startsWith("/customer/")) {
      const pathSlug = pathname.replace(/^\/customer\/?/, "").split("/")[0];
      if (pathSlug && pathSlug.toLowerCase() !== sub.slug.toLowerCase()) {
        return NextResponse.redirect(getCanonicalShopUrl(pathSlug, rawHost), 308);
      }
      return NextResponse.next();
    }

    // Rewrite root access on {shop_slug}.mellod.in to internal /customer/[slug] route
    const url = request.nextUrl.clone();
    const subPath = pathname === "/" ? "" : pathname;
    url.pathname = `/customer/${encodeURIComponent(sub.slug)}${subPath}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
