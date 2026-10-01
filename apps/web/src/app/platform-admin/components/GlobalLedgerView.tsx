"use client";

import React, { useState } from "react";
import {
  SearchIcon,
  DownloadIcon,
  CopyIcon,
  ExternalLinkIcon,
  LedgerIcon,
} from "./AdminIcons";
import { ROOT_DOMAIN } from "@printap/shared";
import type { GlobalPrintEvent } from "./BentoOverview";

interface GlobalLedgerViewProps {
  events: GlobalPrintEvent[];
  globalTotalCharge: number;
}

export function GlobalLedgerView({ events, globalTotalCharge }: GlobalLedgerViewProps) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEvents = events.filter((ev) => {
    const term = search.toLowerCase();
    return (
      ev.session_id.toLowerCase().includes(term) ||
      (ev.shop_name && ev.shop_name.toLowerCase().includes(term)) ||
      (ev.shop_slug && ev.shop_slug.toLowerCase().includes(term)) ||
      ev.shop_id.toLowerCase().includes(term)
    );
  });

  const totalFeeSum = filteredEvents.reduce(
    (acc, ev) => acc + (Number(ev.fee_amount) || globalTotalCharge || 1),
    0
  );

  const handleCopySession = (sessionId: string) => {
    navigator.clipboard.writeText(sessionId);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (filteredEvents.length === 0) return;
    const headers = ["Session ID", "Shop Name", "Subdomain", "Fee (INR)", "Timestamp"];
    const rows = filteredEvents.map((ev) => [
      ev.session_id,
      `"${ev.shop_name || "Unknown"}"`,
      `${ev.shop_slug || ev.shop_id.slice(0, 8)}.${ROOT_DOMAIN}`,
      (Number(ev.fee_amount) || globalTotalCharge || 1).toFixed(2),
      ev.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `printap_ledger_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Bento Summary Row ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            Recorded Ledger Events
          </div>
          <div className="text-3xl font-black font-mono text-[--color-foreground]">
            {filteredEvents.length}
          </div>
          <div className="text-xs text-[--color-muted] mt-1">Realtime print handshakes</div>
        </div>

        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            Total Billed Platform Fee
          </div>
          <div className="text-3xl font-black font-mono text-emerald-600">
            ₹{totalFeeSum.toFixed(2)}
          </div>
          <div className="text-xs text-[--color-muted] mt-1">Cumulative customer convenience take</div>
        </div>

        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[--color-muted] mb-1">
            P2P Data Retention
          </div>
          <div className="text-3xl font-black font-mono text-indigo-600">
            0 Bytes
          </div>
          <div className="text-xs text-[--color-muted] mt-1">Only session hashes stored in DB</div>
        </div>
      </div>

      {/* ─── Search & Export Control ─── */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4 border border-white/80">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[--color-muted]" />
          <input
            type="text"
            placeholder="Search by session hash, shop name, or subdomain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-panel-subtle border border-black/[0.08] text-xs text-[--color-foreground] placeholder-[--color-muted] focus:outline-none focus:border-black transition"
          />
        </div>

        <button
          onClick={handleExportCsv}
          className="glass-panel-subtle hover:bg-white px-4 py-2.5 rounded-2xl text-xs font-semibold text-[--color-foreground] flex items-center gap-2 border border-black/5 transition"
        >
          <DownloadIcon className="w-3.5 h-3.5 text-indigo-500" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* ─── Ledger Table ─── */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/90">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] bg-black/[0.02] text-[--color-muted]">
                <th className="py-3.5 px-5 font-semibold">WebRTC Session ID</th>
                <th className="py-3.5 px-5 font-semibold">Shop Terminal</th>
                <th className="py-3.5 px-5 font-semibold">Subdomain</th>
                <th className="py-3.5 px-5 font-semibold text-right">Fee Receipt</th>
                <th className="py-3.5 px-5 font-semibold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[--color-muted]">
                    No print transactions recorded.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-black/[0.02] transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[--color-foreground] font-semibold">
                          #{ev.session_id.slice(0, 14)}...
                        </span>
                        <button
                          onClick={() => handleCopySession(ev.session_id)}
                          className="p-1 rounded text-[--color-muted] hover:text-black hover:bg-black/5 transition"
                          title="Copy Full Session UUID"
                        >
                          <CopyIcon className="w-3 h-3" />
                        </button>
                        {copiedId === ev.session_id && (
                          <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-[--color-foreground]">
                      {ev.shop_name || "Unknown Shop"}
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="font-mono text-indigo-500">
                        {ev.shop_slug || ev.shop_id.slice(0, 8)}.{ROOT_DOMAIN}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-600">
                      ₹{Number(ev.fee_amount || globalTotalCharge || 1).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-5 text-right text-[--color-muted] font-mono text-[11px]">
                      {new Date(ev.created_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
