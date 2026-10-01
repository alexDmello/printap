import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractSubdomain } from "@printap/shared";

/**
 * Next.js Edge Middleware for Subdomain-based Routing on mellod.in:
 * - shop.mellod.in / admin.mellod.in -> /desktop-required (Browser Access Blocked • Desktop Only)
 * - /shop-admin / /platform-admin   -> /desktop-required (Browser Access Blocked • Desktop Only)
 * - {slug}.mellod.in               -> /customer/[slug] (Customer Print Experience)
 * - www.mellod.in or mellod.in     -> / (Landing & Marketing)
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

  // Allow direct access to the desktop-required security notice
  if (pathname.startsWith("/desktop-required")) {
    return NextResponse.next();
  }

  const hostHeader = request.headers.get("host") || "";
  const sub = extractSubdomain(hostHeader);

  // 1. Blocked Admin Subdomains (shop.mellod.in or admin.mellod.in)
  // Browser access is strictly disabled — operators must use Desktop Electron apps
  if (sub.type === "blocked-admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/desktop-required";
    url.searchParams.set("target", sub.target);
    return NextResponse.rewrite(url);
  }

  // 2. Direct browser navigation to legacy admin paths is blocked
  if (
    pathname.startsWith("/shop-admin") ||
    pathname.startsWith("/platform-admin") ||
    pathname === "/admin" ||
    pathname === "/shop"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/desktop-required";
    url.searchParams.set("target", pathname.includes("shop") ? "shop" : "platform");
    return NextResponse.rewrite(url);
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
