import React from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import logoImg from "../assets/logo.png";
import type { ExtendedShop, GlobalPrintEvent, NavigationTab } from "../types";
import {
  IconActivity,
  IconCoins,
  IconShops,
  IconPrinter,
  IconTrendingUp,
  IconExternal,
  IconChevronRight,
  IconPlus,
  IconShield,
} from "./Icons";

interface OverviewViewProps {
  shops: ExtendedShop[];
  events: GlobalPrintEvent[];
  activeCount: number;
  suspendedCount: number;
  totalRevenue: number;
  globalPlatformFee: number;
  globalGstAmount: number;
  globalTotalCharge: number;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenCreateModal: () => void;
  onToggleStatus: (shop: ExtendedShop) => void;
}

export function OverviewView({
  shops,
  events,
  activeCount,
  suspendedCount,
  totalRevenue,
  globalPlatformFee,
  globalGstAmount,
  globalTotalCharge,
  setActiveTab,
  onOpenCreateModal,
  onToggleStatus,
}: OverviewViewProps) {
  const recentEvents = events.slice(0, 5);
  const totalGst = totalRevenue * 0.18;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-black border border-zinc-800 p-0.5 flex items-center justify-center shadow-xs">
              <img src={logoImg} alt="Printap Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-lg font-bold text-black tracking-tight">
              Command Deck & Network Pulse
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              侘寂 • WHITE & BLACK BENTO
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Zero-cloud storage WebRTC print network running across all registered campus & retail terminals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveTab("analytics")}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 text-xs font-medium transition flex items-center gap-1.5"
          >
            <span>View Deep Analytics</span>
            <IconChevronRight size={13} />
          </button>
          <button
            onClick={onOpenCreateModal}
            className="wabi-btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
          >
            <IconPlus size={14} />
            <span>Deploy Shop</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Bento 1: Hero Platform Pulse (Span 2 on lg) */}
        <div className="lg:col-span-2 wabi-bento-card rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-black border border-zinc-800 p-0.5 flex items-center justify-center shadow-xs">
                  <img src={logoImg} alt="Printap" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs font-mono font-medium uppercase tracking-wider text-zinc-500">
                  Real-time Operational Matrix
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-black text-white">
                100% OPERATIONAL
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-2">
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div className="text-[11px] text-zinc-500 mb-1">Active Counters</div>
                <div className="text-3xl font-extrabold font-mono text-black">
                  {activeCount}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Ready to receive prints
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div className="text-[11px] text-zinc-500 mb-1">Suspended Counters</div>
                <div className="text-3xl font-extrabold font-mono text-zinc-500">
                  {suspendedCount}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Kill-switched terminals
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div className="text-[11px] text-zinc-500 mb-1">Total Terminals</div>
                <div className="text-3xl font-extrabold font-mono text-black">
                  {shops.length}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  *.{ROOT_DOMAIN} subdomains
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <IconShield size={14} className="text-black" />
              <span className="text-zinc-700">Zero-Cloud Storage Peer-to-Peer Pipeline Active</span>
            </div>
            <button
              onClick={() => setActiveTab("health")}
              className="text-black hover:underline font-mono text-[11px] font-semibold"
            >
              Inspect Topology →
            </button>
          </div>

          <div className="absolute top-0 right-0 w-32 h-32 bg-black/[0.02] rounded-bl-full pointer-events-none" />
        </div>

        {/* Bento 2: Financial Yield Snapshot (Span 1) */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-zinc-100 text-black border border-zinc-200">
                  <IconCoins size={15} />
                </span>
                <span className="text-xs font-mono font-medium uppercase tracking-wider text-zinc-500">
                  Platform Escrow
                </span>
              </div>
              <button
                onClick={() => setActiveTab("pricing")}
                className="text-[10px] font-mono text-zinc-600 hover:text-black hover:underline"
              >
                Configure
              </button>
            </div>

            <div className="text-3xl font-extrabold font-mono text-black">
              ₹{totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Net convenience fee revenue collected across {events.length} verified jobs.
            </p>

            <div className="mt-4 p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Customer Surcharge</span>
                <span className="font-mono font-bold text-black">₹{globalTotalCharge.toFixed(2)} / print</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Base Platform Fee</span>
                <span className="font-mono font-semibold text-black">₹{globalPlatformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Statutory GST (18%)</span>
                <span className="font-mono text-zinc-600">₹{globalGstAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>GST Collected: ₹{totalGst.toFixed(2)}</span>
            <span className="text-black font-semibold">Ready for payout</span>
          </div>
        </div>

        {/* Bento 3: Recent Activity Ledger Stream (Span 2 on lg) */}
        <div className="lg:col-span-2 wabi-bento-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-100 text-black border border-zinc-200">
                <IconPrinter size={15} />
              </span>
              <h3 className="text-sm font-bold text-black">
                Latest Print Transactions
              </h3>
            </div>

            <button
              onClick={() => setActiveTab("ledger")}
              className="text-xs font-mono text-zinc-600 hover:text-black hover:underline flex items-center gap-1 font-medium"
            >
              <span>Full Ledger ({events.length})</span>
              <IconChevronRight size={12} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-400 font-mono">
                  <th className="pb-2.5 font-normal">Session</th>
                  <th className="pb-2.5 font-normal">Terminal Shop</th>
                  <th className="pb-2.5 font-normal">Subdomain</th>
                  <th className="pb-2.5 font-normal text-right">Fee</th>
                  <th className="pb-2.5 font-normal text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-400">
                      No print transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-zinc-50 transition">
                      <td className="py-2.5 font-mono text-zinc-500">
                        #{ev.session_id.slice(0, 8)}
                      </td>
                      <td className="py-2.5 font-medium text-black">
                        {ev.shop_name}
                      </td>
                      <td className="py-2.5 font-mono text-zinc-700">
                        {ev.shop_slug}.{ROOT_DOMAIN}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-black">
                        ₹{Number(ev.fee_amount || globalPlatformFee).toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right text-[11px] text-zinc-400">
                        {new Date(ev.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bento 4: Quick Kill-Switch Triage (Span 1) */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-black">
                Terminal Kill-Switch Triage
              </h3>
              <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
                遮断 • SWITCH
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Instantly revoke customer access to any terminal counter with one tap.
            </p>

            <div className="space-y-2">
              {shops.slice(0, 4).map((s) => {
                const isSuspended = s.status === "suspended";
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs"
                  >
                    <div className="truncate mr-2">
                      <div className="font-medium text-black truncate">{s.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {s.slug || s.id.slice(0, 8)}.{ROOT_DOMAIN}
                      </div>
                    </div>

                    <button
                      onClick={() => onToggleStatus(s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition shrink-0 ${
                        isSuspended
                          ? "bg-zinc-200 text-zinc-700 border border-zinc-300 hover:bg-zinc-300"
                          : "bg-black text-white hover:bg-zinc-800"
                      }`}
                    >
                      {isSuspended ? "Suspended" : "Active"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-zinc-100 text-center">
            <button
              onClick={() => setActiveTab("shops")}
              className="text-xs font-mono text-zinc-600 hover:text-black hover:underline font-medium"
            >
              Manage all {shops.length} shop counters →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
