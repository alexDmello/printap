"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUpIcon,
  DownloadIcon,
  PricingIcon,
  StoreIcon,
  LedgerIcon,
  HealthIcon,
  ExternalLinkIcon,
} from "./AdminIcons";
import { ROOT_DOMAIN, getShopCustomerUrl } from "@printap/shared";
import type { ExtendedShop, GlobalPrintEvent } from "./BentoOverview";

interface AnalyticsViewProps {
  shops: ExtendedShop[];
  events: GlobalPrintEvent[];
  globalPlatformFee: number;
  globalGstPercentage: number;
  globalGstAmount: number;
  globalTotalCharge: number;
}

type Timeframe = "24h" | "7d" | "30d" | "all";
type ChartMetric = "volume" | "revenue";

export function AnalyticsView({
  shops,
  events,
  globalPlatformFee,
  globalGstPercentage,
  globalGstAmount,
  globalTotalCharge,
}: AnalyticsViewProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("volume");
  const [hoveredPoint, setHoveredPoint] = useState<{
    dateStr: string;
    volume: number;
    revenue: number;
    x: number;
    y: number;
  } | null>(null);

  // Filter events based on timeframe
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    let threshold = 0;
    if (timeframe === "24h") threshold = now - 24 * 60 * 60 * 1000;
    else if (timeframe === "7d") threshold = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeframe === "30d") threshold = now - 30 * 24 * 60 * 60 * 1000;

    if (threshold === 0) return events;
    return events.filter((ev) => new Date(ev.created_at).getTime() >= threshold);
  }, [events, timeframe]);

  // Aggregate Metrics
  const totalVolume = filteredEvents.length;
  const totalGrossRevenue = filteredEvents.reduce(
    (acc, ev) => acc + (Number(ev.fee_amount) || globalTotalCharge || 1),
    0
  );
  const netPlatformFee =
    Math.round(totalGrossRevenue * (globalPlatformFee / (globalTotalCharge || 1)) * 100) / 100;
  const accruedGst = Math.round((totalGrossRevenue - netPlatformFee) * 100) / 100;
  const avgFeePerPrint = totalVolume > 0 ? (totalGrossRevenue / totalVolume).toFixed(2) : "0.00";

  // Terminal adoption: how many shops have at least 1 print in timeframe
  const activeShopsInPeriod = useMemo(() => {
    const set = new Set(filteredEvents.map((ev) => ev.shop_id));
    return set.size;
  }, [filteredEvents]);

  const terminalAdoptionRate =
    shops.length > 0 ? Math.round((activeShopsInPeriod / shops.length) * 100) : 0;

  // Chart data: daily grouping (last 7 or 14 points)
  const chartData = useMemo(() => {
    const daysCount = timeframe === "24h" ? 24 : timeframe === "7d" ? 7 : 14;
    const isHourly = timeframe === "24h";

    const buckets: Record<string, { label: string; volume: number; revenue: number }> = {};
    const now = new Date();

    if (isHourly) {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = `${d.getHours()}:00`;
        buckets[key] = { label: key, volume: 0, revenue: 0 };
      }

      filteredEvents.forEach((ev) => {
        const d = new Date(ev.created_at);
        const key = `${d.getHours()}:00`;
        if (buckets[key]) {
          buckets[key].volume += 1;
          buckets[key].revenue += Number(ev.fee_amount) || globalTotalCharge || 1;
        }
      });
    } else {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        buckets[key] = { label: key, volume: 0, revenue: 0 };
      }

      filteredEvents.forEach((ev) => {
        const d = new Date(ev.created_at);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (buckets[key]) {
          buckets[key].volume += 1;
          buckets[key].revenue += Number(ev.fee_amount) || globalTotalCharge || 1;
        }
      });
    }

    return Object.values(buckets);
  }, [filteredEvents, timeframe, globalTotalCharge]);

  // Hourly Histogram (00 to 23)
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i}:00`,
      count: 0,
    }));

    filteredEvents.forEach((ev) => {
      const h = new Date(ev.created_at).getHours();
      if (hours[h]) hours[h].count += 1;
    });

    const maxCount = Math.max(...hours.map((h) => h.count), 1);
    return { hours, maxCount };
  }, [filteredEvents]);

  // Top shops in period
  const shopPerformance = useMemo(() => {
    const counts: Record<string, { prints: number; revenue: number }> = {};
    filteredEvents.forEach((ev) => {
      if (!counts[ev.shop_id]) counts[ev.shop_id] = { prints: 0, revenue: 0 };
      counts[ev.shop_id].prints += 1;
      counts[ev.shop_id].revenue += Number(ev.fee_amount) || globalTotalCharge || 1;
    });

    const list = shops.map((s) => {
      const stats = counts[s.id] || { prints: 0, revenue: 0 };
      return {
        ...s,
        periodPrints: stats.prints,
        periodRevenue: stats.revenue,
      };
    });

    return list.sort((a, b) => b.periodPrints - a.periodPrints);
  }, [shops, filteredEvents, globalTotalCharge]);

  // Peak hour
  const peakHour = useMemo(() => {
    let max = 0;
    let peak = 12;
    hourlyData.hours.forEach((h) => {
      if (h.count > max) {
        max = h.count;
        peak = h.hour;
      }
    });
    return { hour: peak, count: max };
  }, [hourlyData]);

  // CSV Export handler
  const handleExportCsv = () => {
    if (filteredEvents.length === 0) {
      alert("No data available to export for this timeframe.");
      return;
    }

    const headers = ["Session ID", "Shop Name", "Shop Slug", "Platform Fee (₹)", "Timestamp"];
    const rows = filteredEvents.map((ev) => [
      ev.session_id,
      `"${ev.shop_name || "Unknown"}"`,
      ev.shop_slug || "",
      (Number(ev.fee_amount) || globalTotalCharge || 1).toFixed(2),
      ev.created_at,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `printap_analytics_${timeframe}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Calculation
  const chartValues = chartData.map((d) => (chartMetric === "volume" ? d.volume : d.revenue));
  const maxVal = Math.max(...chartValues, 4);
  const minVal = 0;
  const svgWidth = 650;
  const svgHeight = 220;
  const padX = 35;
  const padY = 25;
  const innerW = svgWidth - padX * 2;
  const innerH = svgHeight - padY * 2;

  const points = chartData.map((d, idx) => {
    const val = chartMetric === "volume" ? d.volume : d.revenue;
    const x = padX + (idx / Math.max(chartData.length - 1, 1)) * innerW;
    const y = padY + innerH - ((val - minVal) / (maxVal - minVal || 1)) * innerH;
    return { ...d, x, y, val };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, "");

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x},${padY + innerH} L ${points[0].x},${padY + innerH} Z`
      : "";

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Top Control Bar: Timeframe Picker & Export ─── */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4 border border-white/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[--color-muted] mr-1 hidden sm:inline">
            Period:
          </span>
          {(
            [
              { key: "24h", label: "Last 24 Hours" },
              { key: "7d", label: "Last 7 Days" },
              { key: "30d", label: "Last 30 Days" },
              { key: "all", label: "All Time" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeframe(t.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeframe === t.key
                  ? "bg-black text-white shadow-sm"
                  : "glass-panel-subtle hover:bg-white text-[--color-muted] hover:text-[--color-foreground]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleExportCsv}
          className="glass-panel-subtle hover:bg-white px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[--color-foreground] flex items-center gap-2 border border-black/5 transition"
        >
          <DownloadIcon className="w-3.5 h-3.5 text-indigo-500" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* ─── Bento Row 1: KPI Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-panel rounded-3xl p-5 bento-card border border-white/90">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            Gross Revenue
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600">
            ₹{totalGrossRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-[--color-muted] mt-1">Platform fee + tax</div>
        </div>

        <div className="glass-panel rounded-3xl p-5 bento-card border border-white/90">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            Net Take
          </div>
          <div className="text-2xl font-black font-mono text-[--color-foreground]">
            ₹{netPlatformFee.toFixed(2)}
          </div>
          <div className="text-[10px] text-[--color-muted] mt-1">Base convenience fee</div>
        </div>

        <div className="glass-panel rounded-3xl p-5 bento-card border border-white/90">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            GST Accrued
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600">
            ₹{accruedGst.toFixed(2)}
          </div>
          <div className="text-[10px] text-indigo-500/80 mt-1">18% tax portion</div>
        </div>

        <div className="glass-panel rounded-3xl p-5 bento-card border border-white/90">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            Total Print Volume
          </div>
          <div className="text-2xl font-black font-mono text-purple-600">
            {totalVolume}
          </div>
          <div className="text-[10px] text-[--color-muted] mt-1">Completed jobs</div>
        </div>

        <div className="glass-panel rounded-3xl p-5 bento-card border border-white/90">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            Avg Fee / Print
          </div>
          <div className="text-2xl font-black font-mono text-amber-600">
            ₹{avgFeePerPrint}
          </div>
          <div className="text-[10px] text-[--color-muted] mt-1">Effective ticket take</div>
        </div>

        <div className="glass-panel rounded-3xl p-5 bento-card border border-white/90">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            Active Counters
          </div>
          <div className="text-2xl font-black font-mono text-blue-600">
            {activeShopsInPeriod} / {shops.length}
          </div>
          <div className="text-[10px] text-blue-500/80 mt-1">{terminalAdoptionRate}% adoption</div>
        </div>
      </div>

      {/* ─── Bento Row 2: Trend Chart (8 cols) & Financial Breakdown (4 cols) ─── */}
      <div className="grid grid-cols-12 gap-5">
        {/* SVG Interactive Trend Chart */}
        <div className="col-span-12 lg:col-span-8 glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-[--color-foreground]">
                  Network Velocity & Print Trajectory
                </h3>
                <p className="text-[11px] text-[--color-muted]">
                  Aggregated throughput across all active shop terminals
                </p>
              </div>

              {/* Toggle metric */}
              <div className="flex items-center rounded-xl p-0.5 bg-black/[0.04]">
                <button
                  onClick={() => setChartMetric("volume")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    chartMetric === "volume"
                      ? "bg-white text-[--color-foreground] shadow-sm"
                      : "text-[--color-muted]"
                  }`}
                >
                  Prints
                </button>
                <button
                  onClick={() => setChartMetric("revenue")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    chartMetric === "revenue"
                      ? "bg-white text-[--color-foreground] shadow-sm"
                      : "text-[--color-muted]"
                  }`}
                >
                  Revenue (₹)
                </button>
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="relative w-full overflow-hidden mt-4">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-56 overflow-visible"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = padY + innerH * pct;
                  const labelVal = Math.round(maxVal * (1 - pct));
                  return (
                    <g key={pct}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={svgWidth - padX}
                        y2={y}
                        stroke="rgba(0,0,0,0.06)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={padX - 8}
                        y={y + 3}
                        fontSize="9"
                        fill="#a1a1aa"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {chartMetric === "revenue" ? `₹${labelVal}` : labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Area under curve */}
                {areaD && <path d={areaD} fill="url(#chartGradient)" />}

                {/* Line Path */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points */}
                {points.map((pt, i) => (
                  <g key={i}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      className="cursor-pointer hover:scale-150 transition-transform"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          dateStr: pt.label,
                          volume: pt.volume,
                          revenue: pt.revenue,
                          x: pt.x,
                          y: pt.y,
                        })
                      }
                    />
                    {/* X-axis labels on every other tick */}
                    {(i % 2 === 0 || i === points.length - 1) && (
                      <text
                        x={pt.x}
                        y={svgHeight - 4}
                        fontSize="9"
                        fill="#71717a"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {pt.label}
                      </text>
                    )}
                  </g>
                ))}
              </svg>

              {/* Hover Tooltip Card */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none glass-strong px-3 py-2 rounded-xl text-xs shadow-xl border border-black/10 z-20"
                  style={{
                    left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                    top: `${Math.max(10, (hoveredPoint.y / svgHeight) * 100 - 30)}%`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div className="font-bold text-[--color-foreground]">
                    {hoveredPoint.dateStr}
                  </div>
                  <div className="text-indigo-600 font-mono font-semibold">
                    {hoveredPoint.volume} prints • ₹{hoveredPoint.revenue.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[--color-muted]">
            <span>Peak Activity: {peakHour.hour}:00 hrs ({peakHour.count} prints spooled)</span>
            <span className="font-mono">Timezone: Asia/Kolkata (IST)</span>
          </div>
        </div>

        {/* Financial & Tax Split Bento (4 cols) */}
        <div className="col-span-12 lg:col-span-4 glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[--color-foreground]">Tax & Margin Engine</h3>
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600">
                <PricingIcon className="w-4 h-4" />
              </span>
            </div>

            {/* Visual Split Bar */}
            <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/[0.04] space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-[--color-muted]">Net Fee Share</span>
                <span className="font-mono font-bold text-[--color-foreground]">
                  {Math.round((globalPlatformFee / (globalTotalCharge || 1)) * 100)}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-black/10 overflow-hidden flex">
                <div
                  className="h-full bg-black"
                  style={{
                    width: `${Math.round((globalPlatformFee / (globalTotalCharge || 1)) * 100)}%`,
                  }}
                  title="Net Platform Fee"
                />
                <div
                  className="h-full bg-indigo-500"
                  style={{
                    width: `${Math.round((globalGstAmount / (globalTotalCharge || 1)) * 100)}%`,
                  }}
                  title="GST Accrual"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-[--color-muted] pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-black" />
                  Net Take: ₹{globalPlatformFee.toFixed(2)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  GST ({globalGstPercentage}%): ₹{globalGstAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Tax Ledger Summary */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-black/[0.06]">
                <span className="text-[--color-muted]">Period Gross Billed</span>
                <span className="font-mono font-bold">₹{totalGrossRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-black/[0.06]">
                <span className="text-[--color-muted]">Net Platform Margin</span>
                <span className="font-mono font-bold text-emerald-600">
                  ₹{netPlatformFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-black/[0.06]">
                <span className="text-[--color-muted]">GST Output Tax Reserve</span>
                <span className="font-mono font-bold text-indigo-600">
                  ₹{accruedGst.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-indigo-900/80">
            GST values are automatically separated in ledger rows for clean monthly GSTR-1 & 3B filings.
          </div>
        </div>
      </div>

      {/* ─── Bento Row 3: Hourly Peak Heatmap & Terminal Matrix ─── */}
      <div className="grid grid-cols-12 gap-5">
        {/* Hourly Distribution Histogram (5 cols) */}
        <div className="col-span-12 lg:col-span-5 glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[--color-foreground]">
                  Hourly Print Distribution
                </h3>
                <p className="text-[11px] text-[--color-muted]">
                  Customer queue demand by hour of the day
                </p>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600">
                24H Cycle
              </span>
            </div>

            {/* 24 Bar histogram */}
            <div className="pt-4 flex items-end justify-between gap-1 h-36">
              {hourlyData.hours.map((h) => {
                const heightPct = Math.max(8, Math.round((h.count / hourlyData.maxCount) * 100));
                const isPeak = h.hour === peakHour.hour && peakHour.count > 0;

                return (
                  <div
                    key={h.hour}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        isPeak
                          ? "bg-indigo-600 shadow-md shadow-indigo-500/30"
                          : h.count > 0
                          ? "bg-black/60 group-hover:bg-black"
                          : "bg-black/10"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    {h.hour % 4 === 0 && (
                      <span className="text-[8px] font-mono text-[--color-muted]">
                        {h.hour}
                      </span>
                    )}

                    {/* Tooltip */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex px-1.5 py-0.5 rounded bg-black text-white text-[9px] font-mono whitespace-nowrap z-20">
                      {h.hour}:00 - {h.count} prints
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] text-xs text-[--color-muted] flex items-center justify-between">
            <span>Peak queue rush: <strong>{peakHour.hour}:00</strong></span>
            <span>Zero cloud bottleneck</span>
          </div>
        </div>

        {/* Terminal Revenue Leaderboard Matrix (7 cols) */}
        <div className="col-span-12 lg:col-span-7 glass-panel rounded-3xl p-6 bento-card border border-white/90">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[--color-foreground]">
                Terminal Performance Matrix
              </h3>
              <p className="text-[11px] text-[--color-muted]">
                Print volume and platform fee contributions by shop
              </p>
            </div>
            <span className="text-xs text-[--color-muted] font-mono">
              {shopPerformance.length} Total Counters
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[--color-muted] text-[11px]">
                  <th className="pb-3 font-semibold">Shop Name & Domain</th>
                  <th className="pb-3 font-semibold text-center">Status</th>
                  <th className="pb-3 font-semibold text-right">Period Prints</th>
                  <th className="pb-3 font-semibold text-right">Fee Generated</th>
                  <th className="pb-3 font-semibold text-right">Counter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {shopPerformance.map((shop) => {
                  const shopUrl = getShopCustomerUrl(shop);
                  return (
                    <tr key={shop.id} className="hover:bg-black/[0.02] transition">
                      <td className="py-2.5">
                        <div className="font-semibold text-[--color-foreground]">
                          {shop.name}
                        </div>
                        <div className="font-mono text-[10px] text-[--color-muted]">
                          {shop.slug || shop.id.slice(0, 8)}.{ROOT_DOMAIN}
                        </div>
                      </td>

                      <td className="py-2.5 text-center">
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                            shop.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {shop.status}
                        </span>
                      </td>

                      <td className="py-2.5 text-right font-mono font-bold text-[--color-foreground]">
                        {shop.periodPrints}
                      </td>

                      <td className="py-2.5 text-right font-mono font-bold text-emerald-600">
                        ₹{shop.periodRevenue.toFixed(2)}
                      </td>

                      <td className="py-2.5 text-right">
                        <a
                          href={shopUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg hover:bg-black/5 text-indigo-500 inline-flex items-center gap-1"
                          title="Open Customer Counter"
                        >
                          <ExternalLinkIcon className="w-3 h-3" />
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
    </div>
  );
}
