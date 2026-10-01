"use client";

import React, { useState, useMemo } from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import type { ExtendedShop, GlobalPrintEvent, DateRangeOption, LeaderboardItem, DailyVolumePoint } from "../types";
import {
  IconTrendingUp,
  IconCoins,
  IconPrinter,
  IconActivity,
  IconCalendar,
  IconExternal,
  IconCheck,
  IconFilter,
} from "./Icons";

interface AnalyticsViewProps {
  shops: ExtendedShop[];
  events: GlobalPrintEvent[];
  globalPlatformFee: number;
  globalGstPercentage: number;
  globalGstAmount: number;
  globalTotalCharge: number;
}

export function AnalyticsView({
  shops,
  events,
  globalPlatformFee,
  globalGstPercentage,
  globalGstAmount,
  globalTotalCharge,
}: AnalyticsViewProps) {
  const [dateRange, setDateRange] = useState<DateRangeOption>("30d");
  const [hoveredPoint, setHoveredPoint] = useState<DailyVolumePoint | null>(null);

  // Filter events based on date range
  const filteredEvents = useMemo(() => {
    if (dateRange === "all") return events;

    const now = new Date().getTime();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return events.filter((ev) => new Date(ev.created_at).getTime() >= cutoff);
  }, [events, dateRange]);

  // Aggregate Metrics
  const totalRevenue = useMemo(() => {
    return filteredEvents.reduce((acc, ev) => acc + (Number(ev.fee_amount) || globalPlatformFee), 0);
  }, [filteredEvents, globalPlatformFee]);

  const totalGstCollected = useMemo(() => {
    return (totalRevenue * (globalGstPercentage / 100));
  }, [totalRevenue, globalGstPercentage]);

  const activeShopCount = useMemo(() => {
    return shops.filter((s) => s.status === "active").length;
  }, [shops]);

  const utilizationRate = useMemo(() => {
    if (shops.length === 0) return 0;
    const shopsWithPrints = new Set(filteredEvents.map((e) => e.shop_id)).size;
    return Math.round((shopsWithPrints / shops.length) * 100);
  }, [shops, filteredEvents]);

  // Daily Chart Aggregation
  const chartData = useMemo<DailyVolumePoint[]>(() => {
    const daysCount = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 14;
    const buckets: Record<string, { prints: number; revenue: number; label: string; fullDate: string }> = {};

    const now = new Date();
    // Initialize day buckets
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const fullDate = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      buckets[key] = { prints: 0, revenue: 0, label, fullDate };
    }

    // Fill with actual events
    filteredEvents.forEach((ev) => {
      const key = ev.created_at.split("T")[0];
      if (buckets[key]) {
        buckets[key].prints += 1;
        buckets[key].revenue += Number(ev.fee_amount) || globalPlatformFee;
      }
    });

    return Object.entries(buckets).map(([dateKey, val]) => ({
      dateKey,
      label: val.label,
      fullDate: val.fullDate,
      printCount: val.prints,
      revenue: val.revenue,
    }));
  }, [filteredEvents, dateRange, globalPlatformFee]);

  const maxPrintsInChart = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.printCount), 1);
    return Math.max(max, 5); // minimum baseline
  }, [chartData]);

  // Shop Leaderboard
  const leaderboard = useMemo<LeaderboardItem[]>(() => {
    const shopMap = new Map<string, { prints: number; revenue: number }>();
    filteredEvents.forEach((ev) => {
      const cur = shopMap.get(ev.shop_id) || { prints: 0, revenue: 0 };
      cur.prints += 1;
      cur.revenue += Number(ev.fee_amount) || globalPlatformFee;
      shopMap.set(ev.shop_id, cur);
    });

    const items: LeaderboardItem[] = shops.map((s) => {
      const data = shopMap.get(s.id) || { prints: 0, revenue: 0 };
      const pct = filteredEvents.length > 0 ? (data.prints / filteredEvents.length) * 100 : 0;
      return {
        shopId: s.id,
        shopName: s.name,
        slug: s.slug,
        status: s.status,
        printCount: data.prints,
        feeContribution: data.revenue,
        percentageOfTotal: Math.round(pct * 10) / 10,
      };
    });

    return items.sort((a, b) => b.printCount - a.printCount);
  }, [shops, filteredEvents, globalPlatformFee]);

  // Hourly Velocity Breakdown
  const hourlyBreakdown = useMemo(() => {
    let morning = 0;   // 06:00 - 12:00
    let afternoon = 0; // 12:00 - 17:00
    let evening = 0;   // 17:00 - 22:00
    let night = 0;     // 22:00 - 06:00

    filteredEvents.forEach((ev) => {
      const hour = new Date(ev.created_at).getHours();
      if (hour >= 6 && hour < 12) morning++;
      else if (hour >= 12 && hour < 17) afternoon++;
      else if (hour >= 17 && hour < 22) evening++;
      else night++;
    });

    const total = filteredEvents.length || 1;
    return [
      { label: "Morning Session (06:00 - 12:00)", count: morning, pct: Math.round((morning / total) * 100) },
      { label: "Afternoon Peak (12:00 - 17:00)", count: afternoon, pct: Math.round((afternoon / total) * 100) },
      { label: "Evening Rush (17:00 - 22:00)", count: evening, pct: Math.round((evening / total) * 100) },
      { label: "Late Night (22:00 - 06:00)", count: night, pct: Math.round((night / total) * 100) },
    ];
  }, [filteredEvents]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header & Date Range Control */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#2d2922]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c59e5e]" />
            <h2 className="text-lg font-bold text-[#f4ede4] tracking-tight">
              Platform Analytics & Economics
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              分析 • METRICS
            </span>
          </div>
          <p className="text-xs text-[#8a8174] mt-1">
            Real-time throughput, convenience fee accrual, and terminal efficiency across the network.
          </p>
        </div>

        {/* Time Horizon Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#1b1915] border border-[#2d2922]">
          {(["7d", "30d", "90d", "all"] as DateRangeOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setDateRange(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                dateRange === opt
                  ? "bg-[#2c2820] text-[#f4ede4] border border-[#3e372b] shadow-sm"
                  : "text-[#8a8174] hover:text-[#aba293]"
              }`}
            >
              {opt === "7d" ? "7 Days" : opt === "30d" ? "30 Days" : opt === "90d" ? "90 Days" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Grid Row 1: KPI Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Platform Fee Revenue */}
        <div className="wabi-bento-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#8a8174] mb-2">
            <span className="text-xs font-medium">Net Platform Fee</span>
            <div className="p-1.5 rounded-lg bg-[#25211a] text-[#c59e5e] border border-[#383227]">
              <IconCoins size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-[#f4ede4] tracking-tight">
            ₹{totalRevenue.toFixed(2)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#26221c] text-[11px]">
            <span className="text-[#736a5c]">Rate per print</span>
            <span className="font-mono text-[#c59e5e] font-semibold">₹{globalPlatformFee.toFixed(2)} base</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#c59e5e]/5 rounded-bl-full pointer-events-none" />
        </div>

        {/* Metric 2: GST Collected */}
        <div className="wabi-bento-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#8a8174] mb-2">
            <span className="text-xs font-medium">GST Tax Escrow</span>
            <div className="p-1.5 rounded-lg bg-[#25211a] text-[#d96548] border border-[#383227]">
              <IconTrendingUp size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-[#f4ede4] tracking-tight">
            ₹{totalGstCollected.toFixed(2)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#26221c] text-[11px]">
            <span className="text-[#736a5c]">Statutory Rate</span>
            <span className="font-mono text-[#d96548] font-semibold">{globalGstPercentage}% GST</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#d96548]/5 rounded-bl-full pointer-events-none" />
        </div>

        {/* Metric 3: Print Sessions Volume */}
        <div className="wabi-bento-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#8a8174] mb-2">
            <span className="text-xs font-medium">Print Sessions</span>
            <div className="p-1.5 rounded-lg bg-[#25211a] text-[#528364] border border-[#383227]">
              <IconPrinter size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-[#528364] tracking-tight">
            {filteredEvents.length}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#26221c] text-[11px]">
            <span className="text-[#736a5c]">Network Throughput</span>
            <span className="font-mono text-[#aba293] font-semibold">100% P2P WebRTC</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#528364]/5 rounded-bl-full pointer-events-none" />
        </div>

        {/* Metric 4: Terminal Utilization */}
        <div className="wabi-bento-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-[#8a8174] mb-2">
            <span className="text-xs font-medium">Active Counters</span>
            <div className="p-1.5 rounded-lg bg-[#25211a] text-[#73a886] border border-[#383227]">
              <IconActivity size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-[#f4ede4] tracking-tight">
            {activeShopCount} <span className="text-sm font-normal text-[#736a5c]">/ {shops.length}</span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#26221c] text-[11px]">
            <span className="text-[#736a5c]">Counter Activity</span>
            <span className="font-mono text-[#528364] font-semibold">{utilizationRate}% utilized</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#73a886]/5 rounded-bl-full pointer-events-none" />
        </div>
      </div>

      {/* Bento Grid Row 2: Interactive Print Volume Chart (Wide) */}
      <div className="wabi-bento-card rounded-3xl p-6 relative">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#f4ede4]">
                Print Volume & Daily Throughput
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#27231c] text-[#c59e5e] border border-[#383227]">
                Timeline Distribution
              </span>
            </div>
            <p className="text-xs text-[#8a8174] mt-0.5">
              Hover over daily columns for exact print events count and revenue accrued.
            </p>
          </div>

          {hoveredPoint && (
            <div className="px-3.5 py-1.5 rounded-xl bg-[#25221b] border border-[#3e372b] text-xs font-mono text-[#f4ede4] animate-fade-in-up flex items-center gap-3">
              <span className="text-[#8a8174]">{hoveredPoint.fullDate}:</span>
              <span className="text-[#528364] font-bold">{hoveredPoint.printCount} prints</span>
              <span className="text-[#c59e5e] font-bold">₹{hoveredPoint.revenue.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* SVG/CSS Bar Chart */}
        <div className="h-56 w-full flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 px-2 border-b border-[#2d2922] relative">
          {chartData.map((d, idx) => {
            const heightPct = Math.max(6, Math.round((d.printCount / maxPrintsInChart) * 100));
            const isHovered = hoveredPoint?.dateKey === d.dateKey;
            const hasActivity = d.printCount > 0;

            return (
              <div
                key={d.dateKey}
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
              >
                {/* Bar */}
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full max-w-[32px] rounded-t-lg transition-all duration-200 relative ${
                    isHovered
                      ? "bg-[#c59e5e] shadow-lg shadow-[#c59e5e]/20"
                      : hasActivity
                      ? "bg-[#3e372b] group-hover:bg-[#574d3b]"
                      : "bg-[#211e18] group-hover:bg-[#29251e]"
                  }`}
                >
                  {hasActivity && (
                    <div
                      className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded transition ${
                        isHovered
                          ? "bg-[#c59e5e] text-[#12110e] font-bold scale-110"
                          : "text-[#aba293] opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {d.printCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between items-center pt-2 px-2 text-[10px] font-mono text-[#736a5c]">
          <span>{chartData[0]?.label}</span>
          <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
          <span>{chartData[chartData.length - 1]?.label}</span>
        </div>

        {/* Footer Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-[#26221c] text-xs">
          <div>
            <div className="text-[10px] text-[#736a5c] uppercase font-mono">Total in Period</div>
            <div className="font-bold text-[#f4ede4] font-mono mt-0.5">{filteredEvents.length} jobs</div>
          </div>
          <div>
            <div className="text-[10px] text-[#736a5c] uppercase font-mono">Daily Average</div>
            <div className="font-bold text-[#f4ede4] font-mono mt-0.5">
              {(filteredEvents.length / Math.max(1, chartData.length)).toFixed(1)} prints/day
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#736a5c] uppercase font-mono">Total Accrued</div>
            <div className="font-bold text-[#c59e5e] font-mono mt-0.5">₹{totalRevenue.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#736a5c] uppercase font-mono">Customer Fee</div>
            <div className="font-bold text-[#528364] font-mono mt-0.5">₹{globalTotalCharge.toFixed(2)} / job</div>
          </div>
        </div>
      </div>

      {/* Bento Grid Row 3: Economics & Velocity Split (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bento Card: Surcharge Economics Breakdown */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#f4ede4]">
                Customer Surcharge Yield Breakdown
              </h3>
              <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
                ₹{globalTotalCharge.toFixed(2)} Total
              </span>
            </div>
            <p className="text-xs text-[#8a8174] mb-5">
              Each print job collects ₹{globalTotalCharge.toFixed(2)} surcharge via UPI / Cash before file release.
            </p>

            {/* Split Bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-[#1f1c17] p-0.5 border border-[#332e25] mb-4">
              <div
                style={{ width: `${Math.round((globalPlatformFee / globalTotalCharge) * 100)}%` }}
                className="bg-[#c59e5e] h-full rounded-l-full relative group transition-all"
                title={`Base Platform Fee: ₹${globalPlatformFee.toFixed(2)}`}
              />
              <div
                style={{ width: `${Math.round((globalGstAmount / globalTotalCharge) * 100)}%` }}
                className="bg-[#d96548] h-full rounded-r-full relative group transition-all"
                title={`GST Amount: ₹${globalGstAmount.toFixed(2)}`}
              />
            </div>

            {/* Breakdown List */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 rounded-xl bg-[#201d17] border border-[#2d2922]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#c59e5e]" />
                  <span className="text-[#f4ede4]">Net Platform Fee (Keep)</span>
                </div>
                <div className="font-mono font-bold text-[#c59e5e]">
                  ₹{globalPlatformFee.toFixed(2)} ({(100 - globalGstPercentage).toFixed(0)}%)
                </div>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-[#201d17] border border-[#2d2922]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#d96548]" />
                  <span className="text-[#f4ede4]">Statutory GST Escrow (Tax)</span>
                </div>
                <div className="font-mono font-bold text-[#d96548]">
                  ₹{globalGstAmount.toFixed(2)} ({globalGstPercentage}%)
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#26221c] flex items-center justify-between text-[11px] text-[#736a5c]">
            <span>Statutory compliance: Tax invoice ready</span>
            <span className="font-mono text-[#aba293]">0% cloud storage overhead</span>
          </div>
        </div>

        {/* Bento Card: Hourly Velocity Heat */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#f4ede4]">
                Print Velocity Distribution
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#25211a] text-[#8a8174] border border-[#383227]">
                Rush Hours
              </span>
            </div>
            <p className="text-xs text-[#8a8174] mb-5">
              Traffic concentration across campus and commercial shop operating hours.
            </p>

            <div className="space-y-4">
              {hourlyBreakdown.map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#aba293]">{item.label}</span>
                    <span className="font-mono text-[#f4ede4] font-semibold">
                      {item.count} prints ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#201d17] overflow-hidden border border-[#2d2922]">
                    <div
                      style={{ width: `${Math.max(2, item.pct)}%` }}
                      className="h-full rounded-full bg-[#528364] transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#26221c] flex items-center justify-between text-[11px] text-[#736a5c]">
            <span>Peak session throughput observed: 12:00 - 17:00</span>
            <span className="font-mono text-[#528364]">● All nodes synced</span>
          </div>
        </div>
      </div>

      {/* Bento Grid Row 4: Top Performing Shops Leaderboard */}
      <div className="wabi-bento-card rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#f4ede4]">
                Top Performing Terminal Counters
              </h3>
              <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
                順位 • RANKING
              </span>
            </div>
            <p className="text-xs text-[#8a8174] mt-0.5">
              Ranked by total customer prints processed and platform fee contributions.
            </p>
          </div>

          <span className="text-xs font-mono text-[#736a5c]">
            {leaderboard.length} registered terminals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2d2922] text-[#736a5c] font-mono">
                <th className="pb-3 w-12 text-center font-normal">Rank</th>
                <th className="pb-3 font-normal">Shop Name</th>
                <th className="pb-3 font-normal">Terminal Subdomain</th>
                <th className="pb-3 font-normal text-right">Prints</th>
                <th className="pb-3 font-normal text-right">Share</th>
                <th className="pb-3 font-normal text-right">Fee Generated</th>
                <th className="pb-3 font-normal text-right">Counter Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26221c]">
              {leaderboard.map((item, index) => {
                const rankBadge =
                  index === 0
                    ? "bg-[#c59e5e]/20 text-[#c59e5e] border-[#c59e5e]/40 font-bold"
                    : index === 1
                    ? "bg-[#aba293]/20 text-[#f4ede4] border-[#aba293]/30 font-semibold"
                    : index === 2
                    ? "bg-[#d96548]/20 text-[#e57c60] border-[#d96548]/30 font-semibold"
                    : "text-[#736a5c]";

                const shopUrl = `https://${item.slug || item.shopId.slice(0, 8)}.${ROOT_DOMAIN}`;

                return (
                  <tr key={item.shopId} className="hover:bg-[#1f1d18]/50 transition">
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono border border-transparent ${rankBadge}`}
                      >
                        {index + 1}
                      </span>
                    </td>

                    <td className="py-3">
                      <div className="font-semibold text-[#f4ede4]">{item.shopName}</div>
                      <div className="text-[10px] font-mono text-[#736a5c] truncate max-w-[140px]">
                        {item.shopId}
                      </div>
                    </td>

                    <td className="py-3 font-mono text-[#6b889a]">
                      {item.slug || item.shopId.slice(0, 8)}.{ROOT_DOMAIN}
                    </td>

                    <td className="py-3 text-right font-mono font-bold text-[#f4ede4]">
                      {item.printCount}
                    </td>

                    <td className="py-3 text-right font-mono text-[#8a8174]">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#201d17] overflow-hidden border border-[#2d2922]">
                          <div
                            style={{ width: `${Math.min(100, item.percentageOfTotal)}%` }}
                            className="h-full bg-[#c59e5e]"
                          />
                        </div>
                        <span>{item.percentageOfTotal}%</span>
                      </div>
                    </td>

                    <td className="py-3 text-right font-mono font-bold text-[#c59e5e]">
                      ₹{item.feeContribution.toFixed(2)}
                    </td>

                    <td className="py-3 text-right">
                      <a
                        href={shopUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#221f19] hover:bg-[#2c2820] text-[#aba293] hover:text-[#f4ede4] border border-[#332e25] text-[11px] transition font-mono"
                      >
                        <span>Open</span>
                        <IconExternal size={11} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
