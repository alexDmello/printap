import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractSubdomain } from "@printap/shared";

/**
 * Next.js Edge Middleware for Subdomain-based Routing on mellod.in:
 * - shop.mellod.in     -> /shop-admin (Shop Owner Portal)
 * - admin.mellod.in    -> /platform-admin (Platform Operator Panel)
 * - {slug}.mellod.in   -> /customer/[slug] (Customer Print Experience)
 * - www.mellod.in or mellod.in -> / (Landing & Marketing)
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

  // 1. Shop Owner Admin: shop.mellod.in
  if (sub.type === "shop-admin") {
    if (!pathname.startsWith("/shop-admin")) {
      const url = request.nextUrl.clone();
      url.pathname = `/shop-admin${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 2. Platform Operator Admin: admin.mellod.in
  if (sub.type === "platform-admin") {
    if (!pathname.startsWith("/platform-admin")) {
      const url = request.nextUrl.clone();
      url.pathname = `/platform-admin${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
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
  // Normal pass-through to root app routes
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
