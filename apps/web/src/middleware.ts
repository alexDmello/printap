import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractSubdomain } from "@printap/shared";

/**
 * Next.js Edge Middleware for Subdomain-based Routing on mellod.in:
 * - {slug}.mellod.in                 -> /customer/[slug] (Customer Print Experience)
 * - www.mellod.in or mellod.in       -> / (Landing & Marketing)
 * - shop.mellod.in / admin.mellod.in -> 404 (Do not exist at all)
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

  const hostHeader = request.headers.get("host") || "";
  const sub = extractSubdomain(hostHeader);

  // 1. Reserved or nonexistent subdomains (e.g. shop.mellod.in, admin.mellod.in)
  // These subdomains must not exist at all — terminate immediately with empty 404 (no page rendered)
  if (sub.type === "not-found") {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Legacy admin routes or removed paths do not exist — terminate with empty 404
  if (
    pathname.startsWith("/shop-admin") ||
    pathname.startsWith("/platform-admin") ||
    pathname.startsWith("/desktop-required") ||
    pathname === "/admin" ||
    pathname === "/shop"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // 3. Customer Print Page: {shop_slug}.mellod.in
  if (sub.type === "customer") {
    if (!pathname.startsWith("/customer")) {
      const url = request.nextUrl.clone();
      const subPath = pathname === "/" ? "" : pathname;
      url.pathname = `/customer/${encodeURIComponent(sub.slug)}${subPath}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 4. Marketing Root: www.mellod.in / mellod.in
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
