"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@printap/shared";

interface ShopOfflineProps {
  shopId?: string;
  shopName: string;
  onGoOnline?: () => void;
}

export default function ShopOffline({
  shopId,
  shopName,
  onGoOnline,
}: ShopOfflineProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isOnlineDetected, setIsOnlineDetected] = useState(false);

  const triggerOnline = useCallback(() => {
    setIsOnlineDetected(true);
    if (onGoOnline) {
      onGoOnline();
    } else {
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [onGoOnline]);

  const handleCheckNow = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      if (shopId) {
        const supabase = getSupabase();
        const { data } = await supabase
          .from("shops")
          .select("is_online, token_balance, status")
          .eq("id", shopId)
          .maybeSingle();

        if (data?.is_online && data?.token_balance > 0 && data?.status !== "suspended") {
          triggerOnline();
          return;
        }
      } else {
        window.location.reload();
        return;
      }
    } catch (err) {
      console.warn("[ShopOffline] Manual check error:", err);
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  useEffect(() => {
    if (!shopId) return;

    const supabase = getSupabase();

    // 1. Subscribe to Realtime Postgres changes on the shops table with unique channel id
    const channelId = `shop-offline-watch-${shopId}-${Math.random().toString(36).substring(2, 9)}`;
    const dbChannel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "shops",
          filter: `id=eq.${shopId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow.is_online === true && newRow.token_balance > 0 && newRow.status !== "suspended") {
            console.log("[ShopOffline] Shop is now ONLINE via database event");
            triggerOnline();
          }
        }
      )
      .subscribe();

    // 2. Fallback polling every 5 seconds
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("shops")
          .select("is_online, token_balance, status")
          .eq("id", shopId)
          .maybeSingle();

        if (data?.is_online && data?.token_balance > 0 && data?.status !== "suspended") {
          triggerOnline();
        }
      } catch (err) {
        console.warn("[ShopOffline] Polling error:", err);
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      try {
        supabase.removeChannel(dbChannel);
      } catch (e) {
        console.warn("[ShopOffline] Cleanup error:", e);
      }
    };
  }, [shopId, triggerOnline]);

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-6 select-none">
      <div className="glass rounded-3xl p-8 sm:p-10 max-w-md w-full text-center relative overflow-hidden border border-black/8 shadow-2xl transition-all">
        {/* Subtle decorative glow ring */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 mb-6">
          <img
            src="/logo.png"
            alt={shopName}
            className="w-7 h-7 rounded-lg object-cover shadow-xs border border-black/10"
          />
        </div>

        {/* Animated Terminal Offline Printer Icon */}
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/15 animate-ping opacity-75" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-b from-amber-500/15 to-amber-500/5 border border-amber-500/30 flex items-center justify-center shadow-inner">
            <svg
              className="w-10 h-10 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {/* Paper feed tray */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 8V4a1 1 0 011-1h8a1 1 0 011 1v4"
              />
              {/* Printer body */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M5 8h14a2 2 0 012 2v6a2 2 0 01-2 2h-1v-4H6v4H5a2 2 0 01-2-2v-6a2 2 0 012-2z"
              />
              {/* Paper exit tray */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 14h10v6H7v-6z"
              />
              {/* Indicator dot */}
              <circle cx="17.5" cy="11.5" r="0.75" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Shop Name & Status Header */}
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
          {shopName}
        </h1>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-600 text-xs font-semibold uppercase tracking-wider mb-4">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Shop is Currently Offline
        </div>

        {/* Explanation Message */}
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          The print terminal at this counter is currently inactive. New print
          orders are temporarily paused. Please check back shortly or visit
          the counter directly.
        </p>

        {/* Auto-refresh monitor pill */}
        <div className="bg-black/[0.03] border border-black/5 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-500 mb-1">
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                isOnlineDetected
                  ? "bg-emerald-500 shadow-sm"
                  : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span>
              {isOnlineDetected
                ? "Terminal back online! Redirecting..."
                : "Live status check active"}
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            This page will automatically refresh as soon as the shop terminal
            reconnects.
          </p>
        </div>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={handleCheckNow}
          disabled={isChecking || isOnlineDetected}
          className="w-full py-3 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg
            className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>{isChecking ? "Checking Terminal..." : "Check Status Now"}</span>
        </button>

        {/* Footer brand */}
        <div className="mt-8 pt-4 border-t border-black/5 text-[11px] text-zinc-400 tracking-wider font-medium select-none">
          powered by PRINTAP
        </div>
      </div>
    </div>
  );
}
