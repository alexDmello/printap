import React, { useState, useMemo } from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import type { GlobalPrintEvent, ExtendedShop } from "../types";
import { IconSearch, IconFilter } from "./Icons";

interface LedgerViewProps {
  events: GlobalPrintEvent[];
  shops: ExtendedShop[];
  globalPlatformFee: number;
}

export function LedgerView({ events, shops, globalPlatformFee }: LedgerViewProps) {
  const [search, setSearch] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<string>("all");

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch =
        ev.session_id.toLowerCase().includes(search.toLowerCase()) ||
        (ev.shop_name && ev.shop_name.toLowerCase().includes(search.toLowerCase())) ||
        (ev.shop_slug && ev.shop_slug.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (selectedShopId !== "all" && ev.shop_id !== selectedShopId) return false;
      return true;
    });
  }, [events, search, selectedShopId]);

  const totalFilteredFee = useMemo(() => {
    return filteredEvents.reduce((acc, ev) => acc + (Number(ev.fee_amount) || globalPlatformFee), 0);
  }, [filteredEvents, globalPlatformFee]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-black tracking-tight">
              Global Print Ledger & Transaction Log
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              LEDGER
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time immutable ledger of print events triggered across all connected shop terminals.
          </p>
        </div>

        <div className="p-2.5 px-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
          <span className="text-xs text-zinc-500">Ledger Yield:</span>
          <span className="text-sm font-bold font-mono text-black">
            ₹{totalFilteredFee.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="wabi-bento-card rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <IconSearch
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="Search by session hash, shop name, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-black placeholder-zinc-400 focus:outline-none focus:border-black font-sans"
          />
        </div>

        {/* Shop Dropdown Filter */}
        <div className="flex items-center gap-2">
          <IconFilter size={13} className="text-zinc-400" />
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-black focus:outline-none focus:border-black font-sans"
          >
            <option value="all">All Terminal Counters ({shops.length})</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.slug || s.id.slice(0, 6)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bento Table Card */}
      <div className="wabi-bento-card rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-mono">
                <th className="py-3.5 px-5 font-normal">Session Hash</th>
                <th className="py-3.5 px-4 font-normal">Terminal Counter</th>
                <th className="py-3.5 px-4 font-normal">Subdomain</th>
                <th className="py-3.5 px-4 font-normal text-right">Fee Accrued</th>
                <th className="py-3.5 px-5 font-normal text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    No print events found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-zinc-50/70 transition">
                    <td className="py-3.5 px-5 font-mono text-zinc-500">
                      #{ev.session_id.slice(0, 10)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-black">
                      {ev.shop_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-700">
                      {ev.shop_slug}.{ROOT_DOMAIN}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-black">
                      ₹{Number(ev.fee_amount || globalPlatformFee).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-right text-[11px] text-zinc-400">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info strip */}
        <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Displaying {filteredEvents.length} transactions
          </span>
          <span className="font-mono text-zinc-400">
            Zero cloud file retention verified
          </span>
        </div>
      </div>
    </div>
  );
}
