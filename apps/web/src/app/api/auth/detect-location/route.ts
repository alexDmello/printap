import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // 1. Check Vercel native edge geolocation headers (ultra-fast, zero latency in production)
    const vercelLat = req.headers.get("x-vercel-ip-latitude");
    const vercelLng = req.headers.get("x-vercel-ip-longitude");
    const vercelCity = req.headers.get("x-vercel-ip-city");
    const vercelRegion = req.headers.get("x-vercel-ip-country-region");
    const vercelPostal = req.headers.get("x-vercel-ip-postal-code");

    if (vercelLat && vercelLng) {
      const lat = parseFloat(vercelLat);
      const lng = parseFloat(vercelLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        return NextResponse.json({
          success: true,
          latitude: lat,
          longitude: lng,
          city: vercelCity ? decodeURIComponent(vercelCity) : "",
          state: vercelRegion ? decodeURIComponent(vercelRegion) : "",
          pincode: vercelPostal || "",
          source: "vercel",
        });
      }
    }

    // 2. Extract client IP
    const forwarded = req.headers.get("x-forwarded-for");
    const rawIp = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "";
    const isPrivate =
      !rawIp ||
      rawIp === "127.0.0.1" ||
      rawIp === "::1" ||
      rawIp.startsWith("192.168.") ||
      rawIp.startsWith("10.") ||
      rawIp.startsWith("172.16.");

    // 3. Provider A: GeoJS (High availability, no API key, works with IPv4 & IPv6)
    try {
      const geojsUrl = isPrivate
        ? "https://get.geojs.io/v1/ip/geo.json"
        : `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(rawIp)}.json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const gRes = await fetch(geojsUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (gRes.ok) {
        const gData = await gRes.json();
        const lat = parseFloat(gData.latitude);
        const lng = parseFloat(gData.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          return NextResponse.json({
            success: true,
            latitude: lat,
            longitude: lng,
            city: gData.city || "",
            state: gData.region || "",
            pincode: "",
            source: "geojs",
          });
        }
      }
    } catch {
      // Fallback below
    }

    // 4. Provider B: ipwho.is
    try {
      const targetUrl = isPrivate
        ? "https://ipwho.is/"
        : `https://ipwho.is/${encodeURIComponent(rawIp)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (
          data &&
          data.success !== false &&
          typeof data.latitude === "number" &&
          typeof data.longitude === "number"
        ) {
          return NextResponse.json({
            success: true,
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city || "",
            state: data.region || "",
            pincode: data.postal || "",
            source: "ipwhois",
          });
        }
      }
    } catch {
      // Fallback below
    }

    // 5. Provider C: ipapi.co
    try {
      const fallbackUrl = isPrivate
        ? "https://ipapi.co/json/"
        : `https://ipapi.co/${encodeURIComponent(rawIp)}/json/`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { "User-Agent": "printap-backend/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (fallbackRes.ok) {
        const fData = await fallbackRes.json();
        if (typeof fData.latitude === "number" && typeof fData.longitude === "number") {
          return NextResponse.json({
            success: true,
            latitude: fData.latitude,
            longitude: fData.longitude,
            city: fData.city || "",
            state: fData.region || "",
            pincode: fData.postal || "",
            source: "ipapi",
          });
        }
      }
    } catch {
      // Ignore
    }

    // 6. Default center (Bangalore center fallback if all network lookups fail)
    return NextResponse.json({
      success: true,
      latitude: 12.9716,
      longitude: 77.5946,
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      source: "default",
    });
  } catch (error) {
    console.error("[DetectLocation API Error]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to detect location" },
      { status: 500 }
    );
  }
}
