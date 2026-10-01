import React, { useState, useMemo } from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import logoImg from "../assets/logo.png";
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
  IconDownload,
  IconFolder,
  IconArchive,
  IconServer,
  IconClose,
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

  // Archival & Database Lifecycle State
  const [dbStatus, setDbStatus] = useState<{
    activeOrdersCount: number;
    activeEventsCount: number;
    lastArchivedMonth: string | null;
  } | null>(null);
  const [localArchives, setLocalArchives] = useState<any[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState("");
  const [offlinePreviewData, setOfflinePreviewData] = useState<{
    month: string;
    orders: any[];
    summary: any;
  } | null>(null);

  const loadArchivalInfo = async () => {
    if (window.electronAPI?.archival) {
      try {
        const status = await window.electronAPI.archival.getStatus();
        setDbStatus(status);
        const list = await window.electronAPI.archival.listLocal();
        setLocalArchives(list || []);
      } catch (err) {
        console.error("Failed to load archival info:", err);
      }
    }
  };

  React.useEffect(() => {
    loadArchivalInfo();
  }, []);

  const handleTriggerArchival = async (monthIdentifier?: string) => {
    if (!window.electronAPI?.archival) return;
    const confirm = window.confirm(
      `Proceed with exporting previous month's data to local disk and purging raw records from Supabase?\n\n• Raw orders and print events will be saved to your local archives folder.\n• Daily summary metrics in Supabase will be safely preserved.\n• Supabase operational database will be cleaned.`
    );
    if (!confirm) return;

    setIsArchiving(true);
    setArchiveMsg("");
    try {
      const res = await window.electronAPI.archival.runExportPurge(monthIdentifier);
      setArchiveMsg(res.message);
      await loadArchivalInfo();
      setTimeout(() => setArchiveMsg(""), 6000);
    } catch (err: any) {
      alert("Archival failed: " + (err.message || String(err)));
    } finally {
      setIsArchiving(false);
    }
  };

  const handleOpenFolder = async (monthIdentifier?: string) => {
    if (window.electronAPI?.archival) {
      await window.electronAPI.archival.openFolder(monthIdentifier);
    }
  };

  const handleInspectArchive = async (monthIdentifier: string) => {
    if (window.electronAPI?.archival) {
      const data = await window.electronAPI.archival.readMonthData(monthIdentifier);
      if (data) {
        setOfflinePreviewData({
          month: monthIdentifier,
          orders: data.orders || [],
          summary: data.summary,
        });
      }
    }
  };

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
    return totalRevenue * (globalGstPercentage / 100);
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
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-black border border-zinc-800 p-0.5 flex items-center justify-center shadow-xs">
              <img src={logoImg} alt="Printap Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-lg font-bold text-black tracking-tight">
              Platform Analytics & Economics
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              分析 • METRICS
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time throughput, convenience fee accrual, and terminal efficiency across the network.
          </p>
        </div>

        {/* Time Horizon Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 border border-zinc-200">
          {(["7d", "30d", "90d", "all"] as DateRangeOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setDateRange(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                dateRange === opt
                  ? "bg-black text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:text-black"
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
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-medium">Net Platform Fee</span>
            <div className="p-1.5 rounded-lg bg-zinc-100 text-black border border-zinc-200">
              <IconCoins size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-black tracking-tight">
            ₹{totalRevenue.toFixed(2)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 text-[11px]">
            <span className="text-zinc-400">Rate per print</span>
            <span className="font-mono text-black font-semibold">₹{globalPlatformFee.toFixed(2)} base</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-black/[0.015] rounded-bl-full pointer-events-none" />
        </div>

        {/* Metric 2: GST Collected */}
        <div className="wabi-bento-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-medium">GST Tax Escrow</span>
            <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200">
              <IconTrendingUp size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-zinc-800 tracking-tight">
            ₹{totalGstCollected.toFixed(2)}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 text-[11px]">
            <span className="text-zinc-400">Statutory Rate</span>
            <span className="font-mono text-zinc-700 font-semibold">{globalGstPercentage}% GST</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-black/[0.015] rounded-bl-full pointer-events-none" />
        </div>

        {/* Metric 3: Print Sessions Volume */}
        <div className="wabi-bento-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-medium">Print Sessions</span>
            <div className="p-1.5 rounded-lg bg-zinc-100 text-black border border-zinc-200">
              <IconPrinter size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-black tracking-tight">
            {filteredEvents.length}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 text-[11px]">
            <span className="text-zinc-400">Network Pipeline</span>
            <span className="font-mono text-zinc-700 font-semibold">100% P2P WebRTC</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-black/[0.015] rounded-bl-full pointer-events-none" />
        </div>

        {/* Metric 4: Terminal Utilization */}
        <div className="wabi-bento-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-medium">Active Counters</span>
            <div className="p-1.5 rounded-lg bg-zinc-100 text-black border border-zinc-200">
              <IconActivity size={14} />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-black tracking-tight">
            {activeShopCount} <span className="text-sm font-normal text-zinc-400">/ {shops.length}</span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 text-[11px]">
            <span className="text-zinc-400">Counter Activity</span>
            <span className="font-mono text-black font-semibold">{utilizationRate}% utilized</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-black/[0.015] rounded-bl-full pointer-events-none" />
        </div>
      </div>

      {/* Bento Grid Row 2: Interactive Print Volume Chart (Wide) */}
      <div className="wabi-bento-card rounded-3xl p-6 relative">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-black">
                Print Volume & Daily Throughput
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                TIMELINE
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Hover over daily columns for exact print events count and revenue accrued.
            </p>
          </div>

          {hoveredPoint && (
            <div className="px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-mono animate-fade-in-up flex items-center gap-3 shadow-md">
              <span className="text-zinc-400">{hoveredPoint.fullDate}:</span>
              <span className="text-white font-bold">{hoveredPoint.printCount} prints</span>
              <span className="text-zinc-300 font-bold">₹{hoveredPoint.revenue.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* White / Black Bar Chart */}
        <div className="h-56 w-full flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 px-2 border-b border-zinc-200 relative">
          {chartData.map((d) => {
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
                      ? "bg-black shadow-lg shadow-black/20"
                      : hasActivity
                      ? "bg-zinc-400 group-hover:bg-zinc-600"
                      : "bg-zinc-100 group-hover:bg-zinc-200"
                  }`}
                >
                  {hasActivity && (
                    <div
                      className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded transition ${
                        isHovered
                          ? "bg-black text-white font-bold scale-110"
                          : "text-zinc-600 opacity-0 group-hover:opacity-100"
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
        <div className="flex justify-between items-center pt-2 px-2 text-[10px] font-mono text-zinc-400">
          <span>{chartData[0]?.label}</span>
          <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
          <span>{chartData[chartData.length - 1]?.label}</span>
        </div>

        {/* Footer Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-zinc-100 text-xs">
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-mono">Total in Period</div>
            <div className="font-bold text-black font-mono mt-0.5">{filteredEvents.length} jobs</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-mono">Daily Average</div>
            <div className="font-bold text-black font-mono mt-0.5">
              {(filteredEvents.length / Math.max(1, chartData.length)).toFixed(1)} prints/day
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-mono">Total Accrued</div>
            <div className="font-bold text-black font-mono mt-0.5">₹{totalRevenue.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-mono">Customer Fee</div>
            <div className="font-bold text-zinc-800 font-mono mt-0.5">₹{globalTotalCharge.toFixed(2)} / job</div>
          </div>
        </div>
      </div>

      {/* Bento Grid Row 3: Economics & Velocity Split (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bento Card: Surcharge Economics Breakdown */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-black">
                Customer Surcharge Yield Breakdown
              </h3>
              <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
                ₹{globalTotalCharge.toFixed(2)} Total
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-5">
              Each print job collects ₹{globalTotalCharge.toFixed(2)} surcharge via UPI / Cash before file release.
            </p>

            {/* Split Bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-zinc-100 p-0.5 border border-zinc-200 mb-4">
              <div
                style={{ width: `${Math.round((globalPlatformFee / globalTotalCharge) * 100)}%` }}
                className="bg-black h-full rounded-l-full relative group transition-all"
                title={`Base Platform Fee: ₹${globalPlatformFee.toFixed(2)}`}
              />
              <div
                style={{ width: `${Math.round((globalGstAmount / globalTotalCharge) * 100)}%` }}
                className="bg-zinc-300 h-full rounded-r-full relative group transition-all"
                title={`GST Amount: ₹${globalGstAmount.toFixed(2)}`}
              />
            </div>

            {/* Breakdown List */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-black" />
                  <span className="text-black font-medium">Net Platform Fee (Keep)</span>
                </div>
                <div className="font-mono font-bold text-black">
                  ₹{globalPlatformFee.toFixed(2)} ({(100 - globalGstPercentage).toFixed(0)}%)
                </div>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-zinc-400" />
                  <span className="text-zinc-700">Statutory GST Escrow (Tax)</span>
                </div>
                <div className="font-mono font-bold text-zinc-700">
                  ₹{globalGstAmount.toFixed(2)} ({globalGstPercentage}%)
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Statutory compliance: Tax invoice ready</span>
            <span className="font-mono text-zinc-600">0% cloud storage overhead</span>
          </div>
        </div>

        {/* Bento Card: Hourly Velocity Heat */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-black">
                Print Velocity Distribution
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                RUSH HOURS
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-5">
              Traffic concentration across campus and commercial shop operating hours.
            </p>

            <div className="space-y-4">
              {hourlyBreakdown.map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-700">{item.label}</span>
                    <span className="font-mono text-black font-semibold">
                      {item.count} prints ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                    <div
                      style={{ width: `${Math.max(2, item.pct)}%` }}
                      className="h-full rounded-full bg-black transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Peak session throughput observed: 12:00 - 17:00</span>
            <span className="font-mono text-black font-semibold">● All nodes synced</span>
          </div>
        </div>
      </div>

      {/* Bento Grid Row 4: Top Performing Shops Leaderboard */}
      <div className="wabi-bento-card rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-black">
                Top Performing Terminal Counters
              </h3>
              <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
                順位 • RANKING
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ranked by total customer prints processed and platform fee contributions.
            </p>
          </div>

          <span className="text-xs font-mono text-zinc-500">
            {leaderboard.length} registered terminals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-400 font-mono">
                <th className="pb-3 w-12 text-center font-normal">Rank</th>
                <th className="pb-3 font-normal">Shop Name</th>
                <th className="pb-3 font-normal">Terminal Subdomain</th>
                <th className="pb-3 font-normal text-right">Prints</th>
                <th className="pb-3 font-normal text-right">Share</th>
                <th className="pb-3 font-normal text-right">Fee Generated</th>
                <th className="pb-3 font-normal text-right">Counter Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {leaderboard.map((item, index) => {
                const rankBadge =
                  index === 0
                    ? "bg-black text-white font-bold"
                    : index === 1
                    ? "bg-zinc-800 text-white font-semibold"
                    : index === 2
                    ? "bg-zinc-200 text-black font-semibold"
                    : "text-zinc-500 font-mono";

                const shopUrl = `https://${item.slug || item.shopId.slice(0, 8)}.${ROOT_DOMAIN}`;

                return (
                  <tr key={item.shopId} className="hover:bg-zinc-50 transition">
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono ${rankBadge}`}
                      >
                        {index + 1}
                      </span>
                    </td>

                    <td className="py-3">
                      <div className="font-semibold text-black">{item.shopName}</div>
                      <div className="text-[10px] font-mono text-zinc-400 truncate max-w-[140px]">
                        {item.shopId}
                      </div>
                    </td>

                    <td className="py-3 font-mono text-zinc-700">
                      {item.slug || item.shopId.slice(0, 8)}.{ROOT_DOMAIN}
                    </td>

                    <td className="py-3 text-right font-mono font-bold text-black">
                      {item.printCount}
                    </td>

                    <td className="py-3 text-right font-mono text-zinc-500">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                          <div
                            style={{ width: `${Math.min(100, item.percentageOfTotal)}%` }}
                            className="h-full bg-black"
                          />
                        </div>
                        <span>{item.percentageOfTotal}%</span>
                      </div>
                    </td>

                    <td className="py-3 text-right font-mono font-bold text-black">
                      ₹{item.feeContribution.toFixed(2)}
                    </td>

                    <td className="py-3 text-right">
                      <a
                        href={shopUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 hover:text-black border border-zinc-200 text-[11px] transition font-mono font-medium"
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

      {/* ─── Bento Section 4: Database Storage & Monthly Archival Management Center ─── */}
      <div className="wabi-card rounded-3xl p-6 bg-white border border-zinc-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-black text-white">
                <IconArchive size={15} />
              </span>
              <h3 className="font-bold text-sm text-black">
                Database Lifecycle & Monthly Archival Center
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Automated 1st of Month
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1 max-w-xl">
              Maintains Supabase lean and privacy-first. Every 1st of the month, completed raw order sessions and documents are safely exported to local storage, and cleared from the live database.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenFolder()}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-black text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <IconFolder size={14} />
              <span>Open Local Archives</span>
            </button>

            <button
              type="button"
              disabled={isArchiving}
              onClick={() => handleTriggerArchival()}
              className="px-4 py-1.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              <IconDownload size={14} className={isArchiving ? "animate-bounce" : ""} />
              <span>{isArchiving ? "Archiving & Purging..." : "Export & Purge Previous Months Now"}</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {archiveMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2 animate-fade-in-up">
            <IconCheck size={14} className="text-emerald-600" />
            <span>{archiveMsg}</span>
          </div>
        )}

        {/* Database Footprint Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Active Supabase Orders</span>
              <IconServer size={13} className="text-zinc-400" />
            </div>
            <div className="text-2xl font-extrabold text-black font-mono">
              {dbStatus ? dbStatus.activeOrdersCount.toLocaleString() : "—"}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Live operational customer checkout queue
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Active Print Events</span>
              <IconPrinter size={13} className="text-zinc-400" />
            </div>
            <div className="text-2xl font-extrabold text-black font-mono">
              {dbStatus ? dbStatus.activeEventsCount.toLocaleString() : "—"}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              Current month physical print events
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Last Archived Month</span>
              <IconCalendar size={13} className="text-zinc-400" />
            </div>
            <div className="text-lg font-bold text-black font-mono">
              {dbStatus?.lastArchivedMonth ? `Month: ${dbStatus.lastArchivedMonth}` : "Initial Cycle"}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Automated scheduler active
            </div>
          </div>
        </div>

        {/* Local Archives Table */}
        <div className="mt-6 pt-5 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Locally Stored Monthly Archives ({localArchives.length})
            </h4>
            <span className="text-[11px] text-zinc-500">
              Stored securely on this computer (offline accessible)
            </span>
          </div>

          {localArchives.length === 0 ? (
            <div className="py-8 text-center rounded-2xl bg-zinc-50/60 border border-dashed border-zinc-200">
              <div className="text-2xl mb-1.5">📦</div>
              <p className="text-xs font-semibold text-zinc-700">No previous month archives yet</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                On the 1st of the month, or when clicking "Export & Purge", historical monthly bundles appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-2.5 font-normal">Month</th>
                    <th className="pb-2.5 font-normal">Orders Saved</th>
                    <th className="pb-2.5 font-normal">Events Saved</th>
                    <th className="pb-2.5 font-normal">Total GMV (INR)</th>
                    <th className="pb-2.5 font-normal">Exported Date</th>
                    <th className="pb-2.5 font-normal">Supabase Purge</th>
                    <th className="pb-2.5 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {localArchives.map((arch) => (
                    <tr key={arch.monthIdentifier} className="hover:bg-zinc-50/80 transition">
                      <td className="py-3 font-mono font-bold text-black">
                        {arch.monthIdentifier}
                      </td>
                      <td className="py-3 font-mono text-zinc-700">
                        {arch.ordersCount} orders
                      </td>
                      <td className="py-3 font-mono text-zinc-700">
                        {arch.eventsCount} events
                      </td>
                      <td className="py-3 font-mono font-bold text-black">
                        ₹{(arch.totalAmountInr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-zinc-500">
                        {new Date(arch.exportedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <IconCheck size={11} /> Cleared
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleInspectArchive(arch.monthIdentifier)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-mono text-[11px] transition"
                          >
                            Inspect Offline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(arch.monthIdentifier)}
                            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-black transition"
                            title="Open folder in Explorer"
                          >
                            <IconFolder size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Offline Archive Inspector Modal ─── */}
      {offlinePreviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full border border-zinc-200 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-black">
                    Offline Archive: {offlinePreviewData.month}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    Local Disk
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Inspecting {offlinePreviewData.orders.length} orders saved locally on this machine.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOfflinePreviewData(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-black transition"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 my-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-2 font-normal">Token</th>
                    <th className="pb-2 font-normal">Session</th>
                    <th className="pb-2 font-normal">Payment</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal">Total (INR)</th>
                    <th className="pb-2 font-normal">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {offlinePreviewData.orders.slice(0, 50).map((o: any) => (
                    <tr key={o.id} className="hover:bg-zinc-50 transition">
                      <td className="py-2.5 font-mono font-bold text-black">
                        {o.token_code || "—"}
                      </td>
                      <td className="py-2.5 font-mono text-zinc-500 text-[11px]">
                        #{o.session_id ? o.session_id.slice(0, 8) : "—"}
                      </td>
                      <td className="py-2.5 uppercase font-mono text-[11px] text-zinc-700">
                        {o.payment_method || "UPI"}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono font-bold text-black">
                        ₹{Number(o.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 text-zinc-500">
                        {new Date(o.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {offlinePreviewData.orders.length > 50 && (
                <div className="p-3 text-center text-xs text-zinc-400 border-t border-zinc-100">
                  Showing first 50 of {offlinePreviewData.orders.length} records. Complete dataset is stored in print_orders.csv and print_orders.json.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-100 flex justify-end">
              <button
                type="button"
                onClick={() => handleOpenFolder(offlinePreviewData.month)}
                className="px-4 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-semibold text-zinc-800 transition"
              >
                Open in Windows Explorer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
