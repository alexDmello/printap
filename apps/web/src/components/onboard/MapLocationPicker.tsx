"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";

interface MapLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    road?: string;
    suburb?: string;
  };
}

export function MapLocationPicker({
  latitude,
  longitude,
  onChange,
}: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [addressPreview, setAddressPreview] = useState<string>("");
  const [detectStatus, setDetectStatus] = useState<string | null>(null);

  // Default coordinate (Bangalore, India center if none specified)
  const defaultLat = latitude ?? 12.9716;
  const defaultLng = longitude ?? 77.5946;

  // Helper to apply location coordinates to map & notify parent
  const applyCoordinates = useCallback(
    (
      lat: number,
      lng: number,
      zoom = 16,
      meta?: { city?: string; state?: string; pincode?: string; address?: string }
    ) => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.setView([lat, lng], zoom);
        } catch {}
      }
      if (markerRef.current) {
        try {
          markerRef.current.setLatLng([lat, lng]);
        } catch {}
      }
      onChange({
        lat,
        lng,
        city: meta?.city || "",
        state: meta?.state || "",
        pincode: meta?.pincode || "",
        address: meta?.address || "",
      });
      reverseGeocode(lat, lng);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]
  );

  // Reverse geocode lat/lng via compliant internal API proxy
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`/api/utils/geocode?action=reverse&lat=${lat}&lng=${lng}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success) {
          const formatted = data.displayName || "";
          setAddressPreview(formatted);
          onChange({
            lat,
            lng,
            address: formatted,
            city: data.city || "",
            state: data.state || "",
            pincode: data.pincode || "",
          });
        }
      } catch (err) {
        console.warn("[MapPicker] Reverse geocode notice:", err);
      }
    },
    [onChange]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;

      // Clean up previous Leaflet instance if present on container
      if ((mapContainerRef.current as any)._leaflet_id && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      const L = await import("leaflet");
      if (!isMounted || !mapContainerRef.current) return;

      // Custom Glowing SVG Pin Icon
      const customPinIcon = L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="position: relative; width: 36px; height: 42px; transform: translate(-50%, -100%); cursor: grab;">
            <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.05888 0 0 8.05888 0 18C0 27.25 14.5 40.5 17.15 41.85C17.68 42.12 18.32 42.12 18.85 41.85C21.5 40.5 36 27.25 36 18C36 8.05888 27.9411 0 18 0Z" fill="#09090B"/>
              <circle cx="18" cy="18" r="8" fill="#FFFFFF"/>
              <circle cx="18" cy="18" r="4" fill="#09090B"/>
            </svg>
            <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 12px; height: 4px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(1px);"></div>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
      });

      try {
        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLng],
          zoom: latitude && longitude ? 16 : 13,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        // Create Draggable Marker
        const marker = L.marker([defaultLat, defaultLng], {
          icon: customPinIcon,
          draggable: true,
        }).addTo(map);

        // Marker drag event
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng });
          reverseGeocode(pos.lat, pos.lng);
        });

        // Map click event
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          onChange({ lat, lng });
          reverseGeocode(lat, lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;

        // Invalidate size once DOM layout settles
        setTimeout(() => {
          if (isMounted && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 300);

        // Initial reverse geocode if initial lat/lng provided
        if (latitude && longitude) {
          reverseGeocode(latitude, longitude);
        }
      } catch (err) {
        console.warn("[MapPicker] Init map warning:", err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []); // Run on mount

  // Sync external coordinates changes to marker
  useEffect(() => {
    if (latitude && longitude && markerRef.current && mapInstanceRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - latitude) > 0.0001 ||
        Math.abs(currentPos.lng - longitude) > 0.0001
      ) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current.setView([latitude, longitude], 16);
      }
    }
  }, [latitude, longitude]);

  // Fast client-side IP fallback
  const detectViaIp = async (): Promise<{ ok: boolean; city?: string }> => {
    // 1. Try GeoJS client-side directly (CORS enabled, instant, free, reliable in India & globally)
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch("https://get.geojs.io/v1/ip/geo.json", {
        signal: controller.signal,
      });
      clearTimeout(tId);
      if (res.ok) {
        const data = await res.json();
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          applyCoordinates(lat, lng, 14, {
            city: data.city || "",
            state: data.region || "",
          });
          return { ok: true, city: data.city || "your area" };
        }
      }
    } catch {}

    // 2. Try server-side detect-location API endpoint
    try {
      const res = await fetch("/api/auth/detect-location");
      if (res.ok) {
        const data = await res.json();
        if (
          data &&
          data.success &&
          typeof data.latitude === "number" &&
          typeof data.longitude === "number"
        ) {
          applyCoordinates(data.latitude, data.longitude, 14, {
            city: data.city || "",
            state: data.state || "",
            pincode: data.pincode || "",
          });
          return { ok: true, city: data.city || "your area" };
        }
      }
    } catch {}

    // 3. Try ipwho.is client-side
    try {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch("https://ipwho.is/", { signal: controller.signal });
      clearTimeout(tId);
      if (res.ok) {
        const data = await res.json();
        if (
          data &&
          data.success !== false &&
          typeof data.latitude === "number" &&
          typeof data.longitude === "number"
        ) {
          applyCoordinates(data.latitude, data.longitude, 14, {
            city: data.city || "",
            state: data.region || "",
            pincode: data.postal || "",
          });
          return { ok: true, city: data.city || "your area" };
        }
      }
    } catch {}

    return { ok: false };
  };

  // Handle Location Auto-detect with graceful 2-stage GPS and multi-source network fallback
  const handleDetectLocation = async () => {
    setIsLocating(true);
    setDetectStatus("Detecting your location...");

    // Helper to query navigator.geolocation with a promise
    const tryBrowserGeo = (
      highAccuracy: boolean,
      timeoutMs: number
    ): Promise<{ lat: number; lng: number } | null> => {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !navigator.geolocation) {
          return resolve(null);
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          () => {
            resolve(null);
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeoutMs,
            maximumAge: highAccuracy ? 10000 : 120000,
          }
        );
      });
    };

    try {
      // 1. First attempt: Device high-accuracy GPS (10s timeout to allow user to click 'Allow')
      let coords = await tryBrowserGeo(true, 10000);

      // 2. Second attempt: If high accuracy failed (e.g. desktop PC without GPS chip), try Wi-Fi/network geolocation
      if (!coords) {
        setDetectStatus("Connecting via Wi-Fi/network location...");
        coords = await tryBrowserGeo(false, 6000);
      }

      if (coords) {
        setIsLocating(false);
        applyCoordinates(coords.lat, coords.lng, 17);
        setDetectStatus("✓ Device location detected! Drag pin onto your exact shop rooftop.");
        return;
      }

      // 3. Fallback: IP-based geolocation
      setDetectStatus("Device GPS unavailable. Locating via internet network...");
      const ipResult = await detectViaIp();
      setIsLocating(false);

      if (ipResult.ok) {
        setDetectStatus(
          `📍 Centered near ${ipResult.city || "your area"}. Drag pin onto your shop rooftop.`
        );
      } else {
        setDetectStatus(
          "Could not detect automatically. Please search your area above or click on the map."
        );
      }
    } catch (err) {
      console.warn("[MapPicker] Location detection error:", err);
      setIsLocating(false);
      setDetectStatus("Could not detect automatically. Please search your area or click on the map.");
    }
  };

  // Search Address / Landmark via compliant internal API proxy
  const handleSearch = async (
    e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `/api/utils/geocode?action=search&q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("[MapPicker] Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.invalidateSize();
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.setView([lat, lng], 16);
    }

    const addr = result.address || {};
    const city = addr.city || addr.town || addr.village || "";
    const state = addr.state || "";
    const pincode = addr.postcode || "";

    setAddressPreview(result.display_name);
    setSearchResults([]);
    setSearchQuery("");

    onChange({
      lat,
      lng,
      address: result.display_name,
      city,
      state,
      pincode,
    });
  };

  // Quick jump to major Indian educational/metro hubs
  const quickCities = [
    { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
    { name: "Delhi NCR", lat: 28.6139, lng: 77.2090 },
    { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
    { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
    { name: "Pune", lat: 18.5204, lng: 73.8567 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  ];

  const handleJumpCity = (cLat: number, cLng: number) => {
    applyCoordinates(cLat, cLng, 14);
  };

  return (
    <div className="w-full space-y-3.5">
      {/* Search Bar & Auto-detect Button */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-24 py-3 text-sm bg-white border border-zinc-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 text-zinc-900 placeholder:text-zinc-400 font-medium shadow-2xs transition-all"
            placeholder="Search college, street, or landmark (e.g. Indiranagar, Bangalore)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleSearch(e);
              }
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Searching
              </span>
            ) : (
              "Search"
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-900 text-xs font-extrabold rounded-2xl shadow-2xs hover:shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50"
        >
          <span className="relative flex h-2.5 w-2.5">
            {isLocating && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
            )}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-950"></span>
          </span>
          <span>{isLocating ? "Finding location..." : "Detect My Location"}</span>
        </button>
      </div>

      {/* Quick City Presets */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-zinc-500">
        <span className="font-bold text-zinc-400 uppercase text-[10px] tracking-wider mr-1">Quick Jump:</span>
        {quickCities.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => handleJumpCity(c.lat, c.lng)}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold border border-zinc-200 transition-all hover:scale-105 cursor-pointer shadow-2xs"
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Detection status message */}
      {detectStatus && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-zinc-100 border border-zinc-200 text-zinc-800 rounded-xl text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-zinc-950 shrink-0"></span>
          <span className="flex-1">{detectStatus}</span>
        </div>
      )}

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="border border-zinc-200 bg-white rounded-xl shadow-lg overflow-hidden divide-y divide-zinc-100 max-h-48 overflow-y-auto">
          {searchResults.map((item) => (
            <button
              key={item.place_id}
              type="button"
              onClick={() => handleSelectResult(item)}
              className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center justify-between"
            >
              <span className="truncate pr-2">{item.display_name}</span>
              <span className="text-[10px] text-zinc-950 font-bold shrink-0">Select →</span>
            </button>
          ))}
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-zinc-200 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Instruction Overlay */}
        <div className="absolute top-2 left-2 z-[400] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-200 text-[11px] text-zinc-800 font-medium shadow-2xs flex items-center gap-1.5 pointer-events-none">
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-950"></span>
          Drag the pin or click on the map to pinpoint your shop
        </div>

        {/* Coordinate Badge */}
        {latitude !== null && longitude !== null && (
          <div className="absolute bottom-2 right-2 z-[400] bg-zinc-950 text-white px-2.5 py-1 rounded-md text-[10px] font-mono shadow-md">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        )}
      </div>

      {/* Geocoded Address Preview */}
      {addressPreview && (
        <div className="flex items-start gap-2 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600">
          <span className="text-zinc-800">📍</span>
          <div className="flex-1 truncate">
            <span className="font-semibold text-zinc-800">Shop Location:</span> {addressPreview}
          </div>
        </div>
      )}
    </div>
  );
}
