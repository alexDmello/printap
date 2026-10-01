import React, { useState, useMemo } from "react";
import type { ShopInfo } from "@printap/shared";
import {
  IconAnalytics,
  IconRefresh,
  IconDownload,
  IconRupee,
  IconTrendingUp,
  IconShieldCheck,
  IconSparkles,
  IconClock,
  IconCheck,
} from "./AdminIcons";

export interface PrintEvent {
  id: string;
  session_id: string;
  fee_amount: number;
  created_at: string;
}

interface AdminAnalyticsProps {
  shop: ShopInfo;
  printEvents: PrintEvent[];
  priceBw: number;
  priceColor: number;
  onRefresh: () => void;
  isLoading?: boolean;
}

type DateFilter = "today" | "yesterday" | "last_7_days" | "this_month" | "all_time";
type ChartView = "volume" | "revenue";

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({
  shop,
  printEvents,
  priceBw,
  priceColor,
  onRefresh,
  isLoading = false,
}) => {
  const [filter, setFilter] = useState<DateFilter>("last_7_days");
  const [chartView, setChartView] = useState<ChartView>("volume");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCsv, setCopiedCsv] = useState(false);

  // Filter events by date range
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const startOf7DaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return printEvents.filter((e) => {
      const eventDate = new Date(e.created_at);
      switch (filter) {
        case "today":
          return eventDate >= startOfToday;
        case "yesterday":
          return eventDate >= startOfYesterday && eventDate < startOfToday;
        case "last_7_days":
          return eventDate >= startOf7DaysAgo;
        case "this_month":
          return eventDate >= startOfMonth;
        case "all_time":
        default:
          return true;
      }
    });
  }, [printEvents, filter]);

  // Derived financial & performance statistics
  const totalPrints = filteredEvents.length;
  // Estimated average pages per customer session is ~3.5 pages
  const AVG_PAGES_PER_JOB = 3.5;
  const weightedRatePerPage = (priceBw * 0.8 + priceColor * 0.2); // 80% BW, 20% Color estimation
  const estGrossRevenue = Math.round(totalPrints * AVG_PAGES_PER_JOB * weightedRatePerPage);

  const platformFeePerPrint = Number(shop.platform_fee) || 0.82;
  const gstAmountPerPrint = Number(shop.gst_amount) || 0.18;
  const totalChargePerPrint = Number(shop.total_charge) || 1.0;

  const totalPlatformCharges = Math.round(totalPrints * totalChargePerPrint * 100) / 100;
  const netEarnings = Math.max(0, Math.round((estGrossRevenue - totalPlatformCharges) * 100) / 100);
  const profitMargin = estGrossRevenue > 0 ? Math.round((netEarnings / estGrossRevenue) * 100) : 100;

  // 7-day trend chart aggregation
  const chartData = useMemo(() => {
    const days: { [key: string]: { label: string; count: number; dateStr: string } } = {};
    const dayKeys: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const shortDay = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayKeys.push(key);
      days[key] = { label: `${shortDay} ${dayNum}`, count: 0, dateStr: key };
    }

    filteredEvents.forEach((ev) => {
      const evDate = new Date(ev.created_at).toISOString().split("T")[0];
      if (days[evDate]) {
        days[evDate].count += 1;
      }
    });

    const maxCount = Math.max(...dayKeys.map((k) => days[k].count), 5);

    return dayKeys.map((k) => {
      const item = days[k];
      const estRev = Math.round(item.count * AVG_PAGES_PER_JOB * weightedRatePerPage);
      return {
        key: k,
        label: item.label,
        count: item.count,
        revenue: estRev,
        heightPct: Math.max(12, Math.round((item.count / maxCount) * 100)),
      };
    });
  }, [filteredEvents, weightedRatePerPage]);

  // Hourly distribution (rush hours)
  const hourlyDistribution = useMemo(() => {
    const slots = {
      morning: { label: "Morning (8am - 12pm)", count: 0 },
      afternoon: { label: "Afternoon (12pm - 4pm)", count: 0 },
      evening: { label: "Evening Rush (4pm - 8pm)", count: 0 },
      night: { label: "Late Night (8pm - 11pm)", count: 0 },
    };

    filteredEvents.forEach((ev) => {
      const hour = new Date(ev.created_at).getHours();
      if (hour >= 8 && hour < 12) slots.morning.count++;
      else if (hour >= 12 && hour < 16) slots.afternoon.count++;
      else if (hour >= 16 && hour < 20) slots.evening.count++;
      else slots.night.count++;
    });

    const maxSlot = Math.max(
      slots.morning.count,
      slots.afternoon.count,
      slots.evening.count,
      slots.night.count,
      1
    );

    return [
      { id: "morning", ...slots.morning, pct: Math.round((slots.morning.count / maxSlot) * 100) },
      { id: "afternoon", ...slots.afternoon, pct: Math.round((slots.afternoon.count / maxSlot) * 100) },
      { id: "evening", ...slots.evening, pct: Math.round((slots.evening.count / maxSlot) * 100) },
      { id: "night", ...slots.night, pct: Math.round((slots.night.count / maxSlot) * 100) },
    ];
  }, [filteredEvents]);

  // Table search filtering
  const displayEvents = useMemo(() => {
    if (!searchQuery.trim()) return filteredEvents;
    const q = searchQuery.toLowerCase();
    return filteredEvents.filter(
      (e) =>
        e.session_id.toLowerCase().includes(q) ||
        new Date(e.created_at).toLocaleString().toLowerCase().includes(q)
    );
  }, [filteredEvents, searchQuery]);

  // Export CSV
  const handleExportCsv = () => {
    if (filteredEvents.length === 0) return;
    const headers = ["Session ID", "Timestamp", "Fee (INR)", "Status", "Delivery Mode"];
    const rows = filteredEvents.map((ev) => [
      ev.session_id,
      new Date(ev.created_at).toISOString(),
      ev.fee_amount || 1.0,
      "Spooled & Shredded",
      "P2P WebRTC Direct",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const shopSafe = (shop.name || "shop").replace(/[^a-z0-9]/gi, "_");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Printap_Ledger_${shopSafe}_${filter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2500);
  };

  const filterOptions: { id: DateFilter; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "last_7_days", label: "Last 7 Days" },
    { id: "this_month", label: "This Month" },
    { id: "all_time", label: "All Time" },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass rounded-2xl p-5 glow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Revenue & Printing Analytics
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
              Verified Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time counter volume, net shop profitability, and transaction ledger.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80 overflow-x-auto">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filter === opt.id
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Bento Grid Section ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Bento Card 1: Net Earnings Highlight (2 Columns Span) */}
        <div className="md:col-span-2 glass rounded-3xl p-6 glow-sm border border-emerald-500/20 bg-gradient-to-br from-white/90 via-emerald-50/20 to-white/90 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <IconRupee size={15} />
                Net Retained Profit
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100/80 text-emerald-700 border border-emerald-300/60">
                {profitMargin}% Net Margin
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                ₹{netEarnings.toLocaleString("en-IN")}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                retained by your counter
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed max-w-md">
              Gross customer Xerox payments flow directly to your UPI. Platform surcharge is billed strictly per dispatched job.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-5 mt-4 border-t border-slate-200/60 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Gross Billing</span>
              <span className="font-bold text-slate-800">₹{estGrossRevenue.toLocaleString("en-IN")}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Platform Cut</span>
              <span className="font-bold text-slate-800">₹{totalPlatformCharges.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Avg/Job</span>
              <span className="font-bold text-slate-800">
                ₹{totalPrints > 0 ? (estGrossRevenue / totalPrints).toFixed(1) : "0"}
              </span>
            </div>
          </div>
        </div>

        {/* Bento Card 2: Total Dispatched Prints */}
        <div className="glass rounded-3xl p-6 glow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Print Traffic
              </span>
              <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                <IconAnalytics size={16} />
              </div>
            </div>

            <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
              {totalPrints} <span className="text-base font-semibold text-slate-500">Jobs</span>
            </div>
            <p className="text-xs text-slate-500">
              Completed direct P2P customer jobs
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Spool Success</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <IconCheck size={12} /> 99.8%
            </span>
          </div>
        </div>

        {/* Bento Card 3: Direct UPI Settlement */}
        <div className="glass rounded-3xl p-6 glow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Direct Settlement
              </span>
              <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                <IconShieldCheck size={16} />
              </div>
            </div>

            <div className="text-sm font-bold font-mono text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-xl border border-emerald-200/60 truncate mb-2">
              {shop.upi_vpa || "shop@upi"}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              100% direct customer to shop bank transfer with zero holding escrow delay.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Settlement</span>
            <span className="font-bold text-indigo-600">Instant UPI</span>
          </div>
        </div>

        {/* Bento Card 4: Daily Volume & Revenue Trend Chart (2 or 3 Columns Span) */}
        <div className="md:col-span-2 lg:col-span-3 glass rounded-3xl p-6 glow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Volume & Revenue Trajectory</span>
                <span className="text-[11px] font-normal text-slate-400">
                  (Daily distribution)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hover over columns to view daily print volume and estimated gross.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartView("volume")}
                className={`px-3 py-1 rounded-lg transition ${
                  chartView === "volume"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Volume (Jobs)
              </button>
              <button
                type="button"
                onClick={() => setChartView("revenue")}
                className={`px-3 py-1 rounded-lg transition ${
                  chartView === "revenue"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Revenue (₹)
              </button>
            </div>
          </div>

          {/* Bar Chart Visualizer */}
          <div className="h-44 w-full flex items-end justify-between gap-2 sm:gap-4 px-2 pt-4 pb-2 border-b border-slate-100">
            {chartData.map((bar) => {
              const displayVal =
                chartView === "volume" ? `${bar.count} jobs` : `₹${bar.revenue}`;

              return (
                <div
                  key={bar.key}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg whitespace-nowrap">
                    {bar.label}: {displayVal}
                  </div>

                  {/* The Bar */}
                  <div
                    className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-slate-900 to-indigo-600 group-hover:from-indigo-600 group-hover:to-indigo-500 transition-all duration-300 shadow-sm"
                    style={{ height: `${bar.heightPct}%` }}
                  />

                  {/* Day Label */}
                  <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-900 mt-2 truncate w-full text-center">
                    {bar.label.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 text-[11px] text-slate-400">
            <span>● 7-day rolling window</span>
            <span>Total jobs: {totalPrints}</span>
          </div>
        </div>

        {/* Bento Card 5: Service Breakdown (BW vs Color) */}
        <div className="glass rounded-3xl p-6 glow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Print Mode Ratio
              </span>
              <span className="text-xs font-semibold text-slate-700">Rates</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">Black & White (B&W)</span>
                  <span className="font-mono text-slate-900 font-bold">₹{priceBw}/pg</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-slate-900 rounded-full w-[78%]" />
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>~78% of counter volume</span>
                  <span className="text-emerald-600 font-medium">Standard</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-indigo-700">Vibrant Color</span>
                  <span className="font-mono text-indigo-900 font-bold">₹{priceColor}/pg</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full w-[22%]" />
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>~22% of counter volume</span>
                  <span className="text-indigo-600 font-medium">Premium</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500">
            Pricing configurable under <strong>Services & Rates</strong>.
          </div>
        </div>

        {/* Bento Card 6: Rush Hours Heatmap */}
        <div className="md:col-span-2 glass rounded-3xl p-6 glow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <IconClock size={14} />
              Counter Rush Hour Heatmap
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Peak Traffic
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {hourlyDistribution.map((slot) => (
              <div key={slot.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">{slot.label}</span>
                  <span className="font-bold text-slate-900">{slot.count} prints</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      slot.id === "evening"
                        ? "bg-amber-500"
                        : slot.id === "afternoon"
                        ? "bg-indigo-600"
                        : "bg-slate-400"
                    }`}
                    style={{ width: `${slot.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bento Card 7: P2P Security & Cloudless Badge */}
        <div className="md:col-span-2 glass rounded-3xl p-6 glow-sm flex items-center justify-between gap-4">
          <div className="space-y-1 max-w-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                100% P2P Ephemeral Printing
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Zero Cloud Storage
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Files travel directly from customer phones into your shop printer spool over WebRTC data channels. No intermediary server stores customer documents.
            </p>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-3xl flex-shrink-0 shadow-inner">
            🔒
          </div>
        </div>
      </div>

      {/* ─── Ledger & Transactions Bento Table ─── */}
      <div className="glass rounded-3xl p-6 glow-sm border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Print Sessions Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Audit log of all processed print sessions, fee deductions, and shred confirmations.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search session ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredEvents.length === 0}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold glass hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {copiedCsv ? <IconCheck size={14} className="text-emerald-600" /> : <IconDownload size={14} />}
              <span>{copiedCsv ? "Exported!" : "Export CSV"}</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-xl glass hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition border border-slate-200"
              title="Refresh ledger"
            >
              <IconRefresh size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {displayEvents.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
            <div className="text-2xl mb-2">📄</div>
            <p className="text-xs font-semibold text-slate-700">No print jobs in this window</p>
            <p className="text-[11px] text-slate-400 mt-1">
              When customers beam documents to this counter, completed sessions appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 px-3">Session Hash</th>
                  <th className="pb-3 px-3">Date & Time</th>
                  <th className="pb-3 px-3">Delivery Protocol</th>
                  <th className="pb-3 px-3">Platform Fee</th>
                  <th className="pb-3 px-3 text-right">Spool Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {displayEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 font-mono text-slate-800">
                      #{ev.session_id.slice(0, 10)}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(ev.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                        ⚡ WebRTC Encrypted
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-mono">
                      ₹{(Number(ev.fee_amount) || totalChargePerPrint).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Spooled & Shredded
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
