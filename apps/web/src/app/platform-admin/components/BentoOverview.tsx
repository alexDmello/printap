"use client";

import React from "react";
import {
  ROOT_DOMAIN,
  getShopCustomerUrl,
  type ShopInfo,
} from "@printap/shared";
import {
  AnalyticsIcon,
  StoreIcon,
  LedgerIcon,
  PricingIcon,
  HealthIcon,
  ExternalLinkIcon,
  TrendingUpIcon,
  PowerIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "./AdminIcons";
import type { AdminTab } from "./AdminSidebar";

export interface ExtendedShop extends ShopInfo {
  printCount?: number;
}

export interface GlobalPrintEvent {
  id: string;
  shop_id: string;
  session_id: string;
  fee_amount: number;
  created_at: string;
  shop_name?: string;
  shop_slug?: string;
}

interface BentoOverviewProps {
  shops: ExtendedShop[];
  events: GlobalPrintEvent[];
  globalPlatformFee: number;
  globalGstPercentage: number;
  globalGstAmount: number;
  globalTotalCharge: number;
  onNavigateTab: (tab: AdminTab) => void;
  onOpenCreateModal: () => void;
  onToggleShopStatus: (shop: ExtendedShop) => void;
}

export function BentoOverview({
  shops,
  events,
  globalPlatformFee,
  globalGstPercentage,
  globalGstAmount,
  globalTotalCharge,
  onNavigateTab,
  onOpenCreateModal,
  onToggleShopStatus,
}: BentoOverviewProps) {
  const activeCount = shops.filter((s) => s.status === "active").length;
  const suspendedCount = shops.filter((s) => s.status === "suspended").length;
  const activeRate = shops.length > 0 ? Math.round((activeCount / shops.length) * 100) : 100;

  const totalRevenue = events.reduce((acc, ev) => acc + (Number(ev.fee_amount) || 1), 0);
  const netPlatformTake = Math.round(totalRevenue * (globalPlatformFee / (globalTotalCharge || 1)) * 100) / 100;
  const accruedGst = Math.round((totalRevenue - netPlatformTake) * 100) / 100;

  // Top shops ranked by print count
  const sortedShops = [...shops].sort((a, b) => (b.printCount || 0) - (a.printCount || 0));
  const topShops = sortedShops.slice(0, 5);
  const maxPrint = topShops[0]?.printCount || 1;

  // Recent 6 events
  const recentEvents = events.slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Bento Grid Row 1: Hero & Sentinel ─── */}
      <div className="grid grid-cols-12 gap-5">
        {/* Card 1: Platform Command Hero (8 cols on lg) */}
        <div className="col-span-12 lg:col-span-8 glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden bento-card border border-white/90">
          {/* Ambient luminous glow background */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-gradient-to-tr from-emerald-500/10 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Printap Core v2.4 Online
                </span>
                <span className="text-xs text-[--color-muted] font-mono">
                  {shops.length} Terminals Registered
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-[--color-foreground] tracking-tight leading-tight">
                Decentralized Print Mesh Infrastructure
              </h2>
              <p className="text-xs sm:text-sm text-[--color-muted] mt-2 max-w-xl leading-relaxed">
                Direct browser-to-desktop WebRTC print spooling with zero cloud file storage liability.
                Manage shop terminals, monitor revenue streams, and enforce instant kill-switch policies.
              </p>
            </div>

            {/* Quick Metrics & Actions Bar */}
            <div className="mt-6 pt-6 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-4">
              <div className="grid grid-cols-3 gap-4 sm:gap-8">
                <div>
                  <div className="text-[11px] font-semibold text-[--color-muted]">Network Prints</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-[--color-foreground]">
                    {events.length}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[--color-muted]">Platform Revenue</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600">
                    ₹{totalRevenue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-[--color-muted]">Active Terminals</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-indigo-600">
                    {activeCount}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => onNavigateTab("analytics")}
                  className="btn-primary px-4 py-2.5 rounded-2xl text-xs font-semibold text-white flex items-center gap-2 shadow-md hover:scale-[1.02] transition"
                >
                  <AnalyticsIcon className="w-3.5 h-3.5" />
                  <span>Deep Analytics →</span>
                </button>
                <button
                  onClick={onOpenCreateModal}
                  className="glass-panel-subtle hover:bg-white px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-[--color-foreground] border border-black/5 transition"
                >
                  + Add Shop
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Kill-Switch Terminal Sentinel (4 cols on lg) */}
        <div className="col-span-12 lg:col-span-4 glass-panel rounded-3xl p-6 sm:p-7 relative overflow-hidden bento-card border border-white/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[--color-muted]">
                Terminal Sentinel
              </span>
              <span className="p-1.5 rounded-xl bg-black/[0.04] text-[--color-foreground]">
                <PowerIcon className="w-4 h-4" />
              </span>
            </div>

            <div className="text-2xl font-black font-mono text-[--color-foreground]">
              {activeRate}%
            </div>
            <div className="text-xs text-[--color-muted] mt-0.5">
              Platform Terminal Health Ratio
            </div>

            {/* Segmented Ratio Bar */}
            <div className="mt-4 mb-4">
              <div className="w-full h-3 rounded-full bg-black/5 overflow-hidden flex p-0.5 gap-1">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500 shadow-sm"
                  style={{ width: `${activeRate}%` }}
                  title={`${activeCount} Active`}
                />
                {suspendedCount > 0 && (
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500 shadow-sm"
                    style={{ width: `${100 - activeRate}%` }}
                    title={`${suspendedCount} Suspended`}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <span className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                  Active Counters
                </span>
                <span className="font-mono font-bold text-emerald-700">{activeCount}</span>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <span className="flex items-center gap-2 text-amber-700 font-medium">
                  <AlertCircleIcon className="w-3.5 h-3.5 text-amber-500" />
                  Suspended (Kill-Switched)
                </span>
                <span className="font-mono font-bold text-amber-700">{suspendedCount}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab("shops")}
            className="mt-5 w-full py-2.5 px-3 rounded-2xl glass-panel-subtle hover:bg-white text-xs font-semibold text-[--color-foreground] flex items-center justify-center gap-2 border border-black/5 transition"
          >
            <span>Manage Kill-Switches</span>
            <ExternalLinkIcon className="w-3 h-3 text-[--color-muted]" />
          </button>
        </div>
      </div>

      {/* ─── Bento Grid Row 2: Financial Pulse, Velocity, Pricing ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 3: Financial Take Bento */}
        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[--color-muted]">
              Gross Platform Revenue
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <TrendingUpIcon className="w-4 h-4" />
            </span>
          </div>

          <div className="text-3xl font-black font-mono text-[--color-foreground]">
            ₹{totalRevenue.toFixed(2)}
          </div>
          <div className="text-xs text-[--color-muted] mt-1">
            Aggregated customer convenience fee
          </div>

          <div className="mt-5 pt-4 border-t border-black/[0.06] grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-black/[0.03]">
              <span className="text-[10px] text-[--color-muted] block">Net Platform Fee</span>
              <span className="font-mono font-bold text-[--color-foreground]">
                ₹{netPlatformTake.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-indigo-500/5">
              <span className="text-[10px] text-indigo-500 block">GST Accrual (18%)</span>
              <span className="font-mono font-bold text-indigo-600">
                ₹{accruedGst.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Rate Card Benchmark Bento */}
        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[--color-muted]">
                Active Platform Fee
              </span>
              <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600">
                <PricingIcon className="w-4 h-4" />
              </span>
            </div>

            <div className="text-3xl font-black font-mono text-indigo-600">
              ₹{globalTotalCharge.toFixed(2)}
              <span className="text-xs font-normal text-[--color-muted] ml-1.5 font-sans">/ print</span>
            </div>
            <div className="text-xs text-[--color-muted] mt-1">
              ₹{globalPlatformFee.toFixed(2)} base + ₹{globalGstAmount.toFixed(2)} ({globalGstPercentage}% GST)
            </div>
          </div>

          <button
            onClick={() => onNavigateTab("pricing")}
            className="mt-5 w-full py-2.5 px-3 rounded-2xl glass-panel-subtle hover:bg-white text-xs font-semibold text-indigo-600 flex items-center justify-center gap-2 border border-indigo-500/15 transition"
          >
            <span>Configure Pricing Engine →</span>
          </button>
        </div>

        {/* Card 5: Zero-Storage P2P Security Bento */}
        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[--color-muted]">
                Storage & Privacy
              </span>
              <span className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600">
                <HealthIcon className="w-4 h-4" />
              </span>
            </div>

            <div className="text-3xl font-black font-mono text-purple-600">
              0 Bytes
            </div>
            <div className="text-xs text-[--color-muted] mt-1">
              Direct Peer-to-Peer file chunking
            </div>

            <p className="text-[11px] text-[--color-muted] mt-3 leading-relaxed">
              Customer PDFs stream directly via WebRTC DataChannels straight to shop desktop printers. Zero server liability.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[--color-muted]">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              WebRTC Signaling Mesh
            </span>
            <span className="font-mono">mellod.in</span>
          </div>
        </div>
      </div>

      {/* ─── Bento Grid Row 3: Leaderboard & Recent Activity ─── */}
      <div className="grid grid-cols-12 gap-5">
        {/* Card 6: Top Performing Terminals Leaderboard (6 cols) */}
        <div className="col-span-12 lg:col-span-6 glass-panel rounded-3xl p-6 bento-card border border-white/90">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[--color-foreground]">
                Top Performing Terminals
              </h3>
              <p className="text-[11px] text-[--color-muted]">Ranked by total direct customer prints</p>
            </div>
            <button
              onClick={() => onNavigateTab("shops")}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              View All ({shops.length})
            </button>
          </div>

          <div className="space-y-3">
            {topShops.length === 0 ? (
              <div className="text-center py-8 text-xs text-[--color-muted]">
                No shops registered yet.
              </div>
            ) : (
              topShops.map((shop, idx) => {
                const count = shop.printCount || 0;
                const pct = maxPrint > 0 ? Math.round((count / maxPrint) * 100) : 0;
                const shopUrl = getShopCustomerUrl(shop);

                return (
                  <div
                    key={shop.id}
                    className="p-3 rounded-2xl glass-panel-subtle hover:bg-white/90 transition-all border border-black/[0.04] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-lg bg-black/[0.05] text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-bold text-[--color-foreground] truncate block">
                            {shop.name}
                          </span>
                          <a
                            href={shopUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-mono text-indigo-500 hover:underline flex items-center gap-1"
                          >
                            <span>{shop.slug || shop.id.slice(0, 8)}.{ROOT_DOMAIN}</span>
                            <ExternalLinkIcon className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono text-[--color-foreground] block">
                          {count} prints
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                            shop.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {shop.status}
                        </span>
                      </div>
                    </div>

                    {/* Volume Bar */}
                    <div className="w-full h-1.5 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.max(6, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card 7: Real-time Live Ledger Feed (6 cols) */}
        <div className="col-span-12 lg:col-span-6 glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[--color-foreground]">
                  Recent Print Sessions
                </h3>
                <p className="text-[11px] text-[--color-muted]">Live network event stream</p>
              </div>
              <button
                onClick={() => onNavigateTab("ledger")}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Open Ledger ({events.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {recentEvents.length === 0 ? (
                <div className="text-center py-8 text-xs text-[--color-muted]">
                  No print events recorded yet.
                </div>
              ) : (
                recentEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-2xl glass-panel-subtle hover:bg-white/90 transition-all border border-black/[0.04] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                        P2P
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-[--color-foreground] truncate">
                          {ev.shop_name || "Terminal Print"}
                        </div>
                        <div className="text-[10px] font-mono text-[--color-muted] truncate">
                          #{ev.session_id.slice(0, 12)}...
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-emerald-600">
                        +₹{Number(ev.fee_amount || 1).toFixed(2)}
                      </div>
                      <div className="text-[9px] text-[--color-muted]">
                        {new Date(ev.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-black/[0.06] flex items-center justify-between text-xs text-[--color-muted]">
            <span>Aggregating across all active counters</span>
            <button
              onClick={() => onNavigateTab("analytics")}
              className="font-semibold text-indigo-600 hover:underline"
            >
              Analyze Trends →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
