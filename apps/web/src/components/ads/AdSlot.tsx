"use client";

import React, { useEffect, useRef, useState } from "react";

export type AdSlotVariant = "rectangle" | "slim-banner";

interface AdSlotProps {
  variant?: AdSlotVariant;
  slotId?: string;
  adClient?: string;
  className?: string;
  compact?: boolean;
}

// Curated realistic dummy ads for campus/student print users in Bangalore/India
const DUMMY_ADS = [
  {
    id: "tech-pass",
    category: "EdTech",
    brand: "CodeCraft Academy",
    badge: "50% Student Discount",
    title: "Full-Stack & System Design Bootcamp",
    description: "Placement-ready curriculum with live mentor support for students.",
    cta: "Claim Offer",
    gradient: "from-blue-600 via-indigo-600 to-violet-700",
    bgPattern: "from-blue-50/70 via-indigo-50/50 to-violet-50/60",
    icon: "💻",
  },
  {
    id: "food-pass",
    category: "Campus Food",
    brand: "CampusBites",
    badge: "₹120 Off First Order",
    title: "Fresh Meal Combos Delivered to Campus",
    description: "Hot lunch & late-night snacks directly to your college gate in 15m.",
    cta: "Order Now",
    gradient: "from-amber-500 via-orange-500 to-rose-600",
    bgPattern: "from-orange-50/70 via-amber-50/50 to-rose-50/60",
    icon: "🍕",
  },
  {
    id: "pg-housing",
    category: "Student Living",
    brand: "NestColive Bangalore",
    badge: "Zero Brokerage",
    title: "Furnished PGs & Co-Living Spaces",
    description: "High-speed Wi-Fi, food & housekeeping. Walk to university.",
    cta: "Explore Rooms",
    gradient: "from-emerald-600 via-teal-600 to-cyan-700",
    bgPattern: "from-emerald-50/70 via-teal-50/50 to-cyan-50/60",
    icon: "🏡",
  },
];

/**
 * Reusable Borderless AdSlot Component
 * - 100% borderless design blending seamlessly into the UI.
 * - Single professional "Ad" watermark merged into the corner.
 * - Interactive/simulated dummy ads with rotating campus offers.
 * - Compact mode support for zero-scroll single-page layouts.
 */
export default function AdSlot({
  variant = "rectangle",
  slotId,
  adClient,
  className = "",
  compact = false,
}: AdSlotProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const [adIndex, setAdIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Rotate dummy ad occasionally
  useEffect(() => {
    const timer = setInterval(() => {
      setAdIndex((prev) => (prev + 1) % DUMMY_ADS.length);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (slotId && adClient && typeof window !== "undefined") {
      try {
        const adsbygoogle = (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle || [];
        adsbygoogle.push({});
      } catch (err) {
        console.warn("[AdSlot] AdSense push error:", err);
      }
    }
  }, [slotId, adClient]);

  const hasLiveAdConfig = Boolean(slotId && adClient);
  const activeAd = DUMMY_ADS[adIndex];

  // ─────────────────────────────────────────────────────────────
  // 1. SLIM BANNER VARIANT (Zero borders, long horizontal strip)
  // ─────────────────────────────────────────────────────────────
  if (variant === "slim-banner") {
    return (
      <div
        className={`w-full relative overflow-hidden rounded-xl bg-gradient-to-r ${activeAd.bgPattern} shadow-2xs transition-all ${className}`}
      >
        {/* Professional Clean "Ad" Watermark merged into corner */}
        <div className="absolute top-0 right-0 z-10">
          <span className="text-[9px] font-bold text-zinc-500 bg-white/80 px-2 py-0.5 rounded-bl-lg shadow-2xs select-none">
            Ad
          </span>
        </div>

        <div className="min-h-[42px] sm:min-h-[48px] flex items-center justify-between px-3 py-1 gap-2">
          {hasLiveAdConfig ? (
            <ins
              ref={adRef}
              className="adsbygoogle block w-full"
              style={{ display: "block" }}
              data-ad-client={adClient}
              data-ad-slot={slotId}
              data-ad-format="horizontal"
              data-full-width-responsive="true"
            />
          ) : (
            <div className="w-full flex items-center justify-between gap-2.5 pr-12 sm:pr-14">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-white shadow-2xs flex items-center justify-center flex-shrink-0 text-xs">
                  {activeAd.icon}
                </div>
                <div className="text-left min-w-0 leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tracking-tight text-zinc-900 truncate">
                      {activeAd.brand}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1 py-0.2 rounded hidden sm:inline-block">
                      {activeAd.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {activeAd.title}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAdIndex((prev) => (prev + 1) % DUMMY_ADS.length)}
                className="flex-shrink-0 px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold shadow-2xs cursor-pointer transition active:scale-95"
              >
                {activeAd.cta} →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. RECTANGLE / VIDEO-CAPABLE VARIANT (Zero borders, compact)
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      className={`w-full max-w-[420px] mx-auto relative overflow-hidden rounded-2xl bg-gradient-to-br ${activeAd.bgPattern} shadow-2xs transition-all ${className}`}
    >
      {/* Professional Clean "Ad" Watermark merged directly into top-right corner */}
      <div className="absolute top-0 right-0 z-20">
        <span className="text-[9px] font-bold text-zinc-500 bg-white/85 px-2.5 py-0.5 rounded-bl-lg shadow-2xs select-none">
          Ad
        </span>
      </div>

      {hasLiveAdConfig ? (
        <div className="p-2 min-h-[140px] flex items-center justify-center">
          <ins
            ref={adRef}
            className="adsbygoogle block w-full"
            style={{ display: "inline-block", width: "100%", height: "200px" }}
            data-ad-client={adClient}
            data-ad-slot={slotId}
            data-ad-format="rectangle"
          />
        </div>
      ) : (
        /* Dynamic Dummy Ad Card */
        <div className={`p-2.5 sm:p-3 flex flex-col justify-between ${compact ? "min-h-[105px] sm:min-h-[115px]" : "min-h-[140px]"}`}>
          {/* Top Brand & Category */}
          <div className="flex items-center gap-2 pr-12">
            <div className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center flex-shrink-0 text-sm">
              {activeAd.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-black tracking-tight text-zinc-900 truncate">
                  {activeAd.brand}
                </span>
                <span className="text-[10px] font-extrabold text-emerald-700">
                  · {activeAd.badge}
                </span>
              </div>
            </div>
          </div>

          {/* Headline & Simulated Video/Interactive Media Strip */}
          <div className="my-1.5 bg-white/90 rounded-xl p-2 shadow-2xs flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <h4 className="text-[11px] font-bold text-zinc-900 line-clamp-1">
                {activeAd.title}
              </h4>
              <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                {activeAd.description}
              </p>
            </div>

            {/* Video Player Micro-Indicator */}
            <div
              onClick={() => setIsPlaying(!isPlaying)}
              className="relative w-10 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden group shadow-2xs"
              title="Interactive Video Ad"
            >
              <div className={`absolute inset-0 bg-gradient-to-tr ${activeAd.gradient} opacity-85`} />
              {isPlaying ? (
                <div className="relative flex items-center gap-0.5">
                  <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
                  <span className="w-0.5 h-3.5 bg-white rounded-full animate-pulse delay-75" />
                  <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse delay-150" />
                </div>
              ) : (
                <svg className="w-3.5 h-3.5 text-white relative ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
              <span className="absolute bottom-0.5 right-0.5 text-[6px] font-bold text-white/90">
                HD
              </span>
            </div>
          </div>

          {/* Bottom Action Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-medium text-zinc-400 truncate">
              {activeAd.category} Promotion
            </span>
            <button
              type="button"
              onClick={() => setAdIndex((prev) => (prev + 1) % DUMMY_ADS.length)}
              className="px-2.5 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold tracking-tight shadow-xs transition cursor-pointer flex-shrink-0 active:scale-95"
            >
              {activeAd.cta} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
