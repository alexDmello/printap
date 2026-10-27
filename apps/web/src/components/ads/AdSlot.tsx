"use client";

import React, { useEffect, useRef } from "react";

export type AdSlotVariant = "rectangle" | "slim-banner";

interface AdSlotProps {
  variant?: AdSlotVariant;
  slotId?: string;
  adClient?: string;
  className?: string;
  label?: string;
}

/**
 * Reusable AdSlot Component supporting:
 * 1. "rectangle": Standard 300x250 / 16:9 video and display banner unit
 * 2. "slim-banner": Standard 320x50 (mobile) / 728x90 (desktop) horizontal leaderboard
 *
 * Prevents Cumulative Layout Shift (CLS) via explicit min-height reservations.
 * Gracefully displays a sleek placeholder if live AdSense keys are not yet configured.
 */
export default function AdSlot({
  variant = "rectangle",
  slotId,
  adClient,
  className = "",
  label = "Sponsored",
}: AdSlotProps) {
  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    // Only attempt to push to AdSense if client and slot are provided
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

  if (variant === "slim-banner") {
    return (
      <div
        className={`w-full relative overflow-hidden rounded-xl border border-zinc-200/80 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 shadow-xs transition-all ${className}`}
      >
        <div className="flex items-center justify-between px-3 py-1 bg-zinc-100/70 border-b border-zinc-200/50">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">
            {label}
          </span>
          <span className="text-[9px] font-medium text-zinc-400">Google Ads / Partner</span>
        </div>

        <div className="min-h-[50px] sm:min-h-[60px] flex items-center justify-center p-1.5 text-center">
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
            <div className="w-full flex items-center justify-between px-3 py-1 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  ⚡
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-zinc-800 truncate">
                    Special Student & Campus Offers
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    Exclusive discounts on stationery, tech upskilling & local PGs
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className="text-[10px] font-bold text-zinc-700 bg-white border border-zinc-200 px-2 py-1 rounded-md shadow-2xs">
                  Learn More
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Variant: "rectangle" (300x250 or 16:9 responsive video container)
  return (
    <div
      className={`w-full max-w-[360px] mx-auto relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-900/[0.02] shadow-xs transition-all ${className}`}
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-100/80 border-b border-zinc-200/70">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">
          {label}
        </span>
        <span className="text-[9px] font-medium text-zinc-400">Ad · Video & Display</span>
      </div>

      {/* Ad Display / Video Area with reserved min-height to prevent CLS */}
      <div className="min-h-[220px] sm:min-h-[250px] w-full flex items-center justify-center p-3">
        {hasLiveAdConfig ? (
          <ins
            ref={adRef}
            className="adsbygoogle block w-full"
            style={{ display: "inline-block", width: "100%", height: "250px" }}
            data-ad-client={adClient}
            data-ad-slot={slotId}
            data-ad-format="rectangle"
          />
        ) : (
          <div className="w-full h-full min-h-[210px] rounded-xl border border-dashed border-zinc-300/80 bg-gradient-to-b from-white to-zinc-50 flex flex-col items-center justify-center p-5 text-center group">
            {/* Play / Media icon for Video simulation */}
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mb-3 shadow-md transition-transform group-hover:scale-105">
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-zinc-800 tracking-tight">
              Sponsored Video & Partner Showcase
            </span>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[240px] leading-relaxed">
              Targeted interactive promotions & campus partner features appear here.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600 border border-zinc-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Standard 300×250 / 16:9 Video Slot</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
