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

  // Default coordinate (Bangalore, India center if none specified)
  const defaultLat = latitude ?? 12.9716;
  const defaultLng = longitude ?? 77.5946;

  // Reverse geocode lat/lng to get address components
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.neighbourhood || addr.suburb || "";
          const city = addr.city || addr.town || addr.village || addr.county || "";
          const state = addr.state || "";
          const pincode = addr.postcode || "";
          const formatted = data.display_name || [road, city, state, pincode].filter(Boolean).join(", ");

          setAddressPreview(formatted);
          onChange({
            lat,
            lng,
            address: formatted,
            city,
            state,
            pincode,
          });
        }
      } catch (err) {
        console.warn("[MapPicker] Reverse geocode error:", err);
      }
    },
    [onChange]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = await import("leaflet");
      if (!isMounted || !mapContainerRef.current) return;

      // Custom Glowing SVG Pin Icon
      const customPinIcon = L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="position: relative; width: 36px; height: 42px; transform: translate(-50%, -100%); cursor: grab;">
            <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.05888 0 0 8.05888 0 18C0 27.25 14.5 40.5 17.15 41.85C17.68 42.12 18.32 42.12 18.85 41.85C21.5 40.5 36 27.25 36 18C36 8.05888 27.9411 0 18 0Z" fill="#4F46E5"/>
              <circle cx="18" cy="18" r="8" fill="#FFFFFF"/>
              <circle cx="18" cy="18" r="4" fill="#10B981"/>
            </svg>
            <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 12px; height: 4px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(1px);"></div>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
      });

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

      // Initial reverse geocode if initial lat/lng provided
      if (latitude && longitude) {
        reverseGeocode(latitude, longitude);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
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

  const [detectStatus, setDetectStatus] = useState<string | null>(null);

  // Fallback to server-side IP geolocation (bypasses browser GPS restrictions & adblockers)
  const detectLocationViaServer = async () => {
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
          const lat = data.latitude;
          const lng = data.longitude;
          if (mapInstanceRef.current && markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
            mapInstanceRef.current.setView([lat, lng], 14);
          }
          onChange({
            lat,
            lng,
            city: data.city || "",
            state: data.state || "",
            pincode: data.pincode || "",
          });
          reverseGeocode(lat, lng);
          return {
            ok: true,
            city: data.city || "your area",
            source: data.source,
          };
        }
      }
    } catch (e) {
      console.warn("[MapPicker] Server geolocation fallback failed:", e);
    }
    return { ok: false };
  };

  // Handle Location Auto-detect with graceful server-side network IP fallback
  const handleDetectLocation = async () => {
    setIsLocating(true);
    setDetectStatus("Detecting location...");

    // Check browser permission status beforehand if available
    let permState: string | null = null;
    try {
      if (typeof window !== "undefined" && navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        permState = perm.state;
      }
    } catch {
      // Ignore
    }

    // If permission is already blocked/denied, bypass GPS wait and use server IP directly
    if (permState === "denied") {
      setDetectStatus("Browser GPS permission is blocked. Locating via network...");
      const serverRes = await detectLocationViaServer();
      setIsLocating(false);
      if (serverRes.ok) {
        setDetectStatus(
          `📍 Centered to ${serverRes.city} via network. Drag pin onto your shop rooftop.`
        );
      } else {
        setDetectStatus("Please search your area or click on the map to place your pin.");
      }
      return;
    }

    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocating(false);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          if (mapInstanceRef.current && markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
            mapInstanceRef.current.setView([lat, lng], 17);
          }
          onChange({ lat, lng });
          reverseGeocode(lat, lng);
          setDetectStatus("✓ High-accuracy device GPS detected! Drag pin if needed.");
        },
        async (err) => {
          console.warn("[MapPicker] Device GPS unavailable (" + err.message + "). Falling back to server network location.");
          setDetectStatus("Locating via network...");
          const serverRes = await detectLocationViaServer();
          setIsLocating(false);
          if (serverRes.ok) {
            setDetectStatus(
              `📍 Centered near ${serverRes.city} via network. Drag pin onto your shop rooftop.`
            );
          } else {
            setDetectStatus("Please search your area or click on the map to place your pin.");
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    } else {
      const serverRes = await detectLocationViaServer();
      setIsLocating(false);
      if (serverRes.ok) {
        setDetectStatus(`📍 Centered near ${serverRes.city} via network. Drag pin onto your shop rooftop.`);
      } else {
        setDetectStatus("Please search your area or click on the map to place your pin.");
      }
    }
  };

  // Search Address / Landmark
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&addressdetails=1&limit=5`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data || []);
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

  return (
    <div className="w-full space-y-3">
      {/* Search Bar & Auto-detect Button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="relative flex-1">
          <input
            type="text"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-20 text-zinc-900 placeholder:text-zinc-400"
            placeholder="Search street, area, city (e.g. Indiranagar, Bangalore)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl transition-colors shrink-0"
        >
          <svg
            className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          </svg>
          <span>{isLocating ? "Locating..." : "Detect My Location"}</span>
        </button>
      </div>

      {/* Detection status message */}
      {detectStatus && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50/90 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 animate-pulse"></span>
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
              className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-700 hover:bg-indigo-50 transition-colors flex items-center justify-between"
            >
              <span className="truncate pr-2">{item.display_name}</span>
              <span className="text-[10px] text-indigo-600 font-semibold shrink-0">Select →</span>
            </button>
          ))}
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-zinc-200 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Instruction Overlay */}
        <div className="absolute top-2 left-2 z-[400] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-200 text-[11px] text-zinc-700 font-medium shadow-sm flex items-center gap-1.5 pointer-events-none">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          Drag the pin or click on the map to pinpoint your store
        </div>

        {/* Coordinate Badge */}
        {latitude !== null && longitude !== null && (
          <div className="absolute bottom-2 right-2 z-[400] bg-zinc-900/90 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-[10px] font-mono shadow-md">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        )}
      </div>

      {/* Geocoded Address Preview */}
      {addressPreview && (
        <div className="flex items-start gap-2 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600">
          <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1 truncate">
            <span className="font-semibold text-zinc-800">Pin Location:</span> {addressPreview}
          </div>
        </div>
      )}
    </div>
  );
}
