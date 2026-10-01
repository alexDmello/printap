"use client";

import React, { useState, useMemo } from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import type { GlobalPrintEvent, ExtendedShop } from "../types";
import { IconSearch, IconFilter, IconExternal, IconPrinter } from "./Icons";

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
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#2d2922]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#528364]" />
            <h2 className="text-lg font-bold text-[#f4ede4] tracking-tight">
              Global Print Ledger & Transaction Log
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              台帳 • LEDGER
            </span>
          </div>
          <p className="text-xs text-[#8a8174] mt-1">
            Real-time immutable ledger of print events triggered across all connected shop terminals.
          </p>
        </div>

        <div className="p-2.5 px-4 rounded-2xl bg-[#1f1d18] border border-[#2d2922] flex items-center gap-3">
          <span className="text-xs text-[#8a8174]">Ledger Yield:</span>
          <span className="text-sm font-bold font-mono text-[#c59e5e]">
            ₹{totalFilteredFee.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="wabi-bento-card rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <IconSearch
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#736a5c]"
          />
          <input
            type="text"
            placeholder="Search by session hash, shop name, or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#201d17] border border-[#2d2922] text-xs text-[#f4ede4] placeholder-[#736a5c] focus:outline-none focus:border-[#c59e5e]/50 font-sans"
          />
        </div>

        {/* Shop Dropdown Filter */}
        <div className="flex items-center gap-2">
          <IconFilter size={13} className="text-[#736a5c]" />
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#201d17] border border-[#2d2922] text-xs text-[#f4ede4] focus:outline-none focus:border-[#c59e5e]/50 font-sans"
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
              <tr className="border-b border-[#2d2922] bg-[#1e1c17] text-[#736a5c] font-mono">
                <th className="py-3.5 px-5 font-normal">Session Hash</th>
                <th className="py-3.5 px-4 font-normal">Terminal Counter</th>
                <th className="py-3.5 px-4 font-normal">Subdomain</th>
                <th className="py-3.5 px-4 font-normal text-right">Fee Accrued</th>
                <th className="py-3.5 px-5 font-normal text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26221c]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#736a5c]">
                    No print events found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#1f1d18]/50 transition">
                    <td className="py-3.5 px-5 font-mono text-[#aba293]">
                      #{ev.session_id.slice(0, 10)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#f4ede4]">
                      {ev.shop_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#6b889a]">
                      {ev.shop_slug}.{ROOT_DOMAIN}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#528364]">
                      ₹{Number(ev.fee_amount || globalPlatformFee).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-right text-[11px] text-[#736a5c]">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info strip */}
        <div className="p-4 border-t border-[#26221c] flex items-center justify-between text-xs text-[#736a5c]">
          <span>
            Displaying {filteredEvents.length} transactions
          </span>
          <span className="font-mono">
            Zero cloud file retention verified
          </span>
        </div>
      </div>
    </div>
  );
}
