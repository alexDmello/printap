import { NextRequest, NextResponse } from "next/server";

interface CacheEntry {
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

// In-memory cache with 5-minute TTL to avoid hitting Nominatim rate limits
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  if (cache.size > 200) {
    // Purge oldest entries if cache grows
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { timestamp: Date.now(), data });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Compliant User-Agent adhering to OpenStreetMap Nominatim terms of service
  const headers = {
    "User-Agent": "Printap/1.0 (contact@mellod.in)",
    "Accept-Language": "en",
  };

  try {
    if (action === "reverse") {
      const lat = searchParams.get("lat");
      const lng = searchParams.get("lng");
      if (!lat || !lng) {
        return NextResponse.json({ error: "lat and lng query parameters required." }, { status: 400 });
      }

      // Round to 5 decimal places (~1m precision) for cache hits
      const roundedLat = parseFloat(lat).toFixed(5);
      const roundedLng = parseFloat(lng).toFixed(5);
      const cacheKey = `rev:${roundedLat},${roundedLng}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return NextResponse.json({ success: true, ...cached, cached: true });
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${roundedLat}&lon=${roundedLng}&addressdetails=1`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Nominatim responded with status ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      if (!data || !data.address) {
        return NextResponse.json({ success: false, error: "No address components found." });
      }

      const addr = data.address;
      const road = addr.road || addr.neighbourhood || addr.suburb || "";
      const city = addr.city || addr.town || addr.village || addr.county || "";
      const state = addr.state || "";
      const pincode = addr.postcode || "";
      const displayName = data.display_name || [road, city, state, pincode].filter(Boolean).join(", ");

      const result = {
        displayName,
        city,
        state,
        pincode,
        road,
      };

      setCache(cacheKey, result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "search") {
      const query = searchParams.get("q");
      if (!query || !query.trim()) {
        return NextResponse.json({ error: "Search query 'q' required." }, { status: 400 });
      }

      const cleanQuery = query.trim().toLowerCase();
      const cacheKey = `search:${cleanQuery}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return NextResponse.json({ success: true, results: cached, cached: true });
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        cleanQuery
      )}&addressdetails=1&limit=5`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Nominatim responded with status ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      setCache(cacheKey, data || []);
      return NextResponse.json({ success: true, results: data || [] });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: 'reverse', 'search'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Geocode API Error]:", error);
    return NextResponse.json({ error: "Failed to query geocoding service." }, { status: 500 });
  }
}
