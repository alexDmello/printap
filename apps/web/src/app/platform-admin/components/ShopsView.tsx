"use client";

import React, { useState, useMemo } from "react";
import { ROOT_DOMAIN, getShopCustomerUrl } from "@printap/shared";
import type { ExtendedShop } from "../types";
import {
  IconSearch,
  IconPlus,
  IconExternal,
  IconEdit,
} from "./Icons";

interface ShopsViewProps {
  shops: ExtendedShop[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (shop: ExtendedShop) => void;
  onToggleStatus: (shop: ExtendedShop) => void;
  globalPlatformFee: number;
}

export function ShopsView({
  shops,
  onOpenCreateModal,
  onOpenEditModal,
  onToggleStatus,
  globalPlatformFee,
}: ShopsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.slug && s.slug.toLowerCase().includes(search.toLowerCase())) ||
        s.upi_vpa.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter === "active") return s.status === "active";
      if (statusFilter === "suspended") return s.status === "suspended";
      return true;
    });
  }, [shops, search, statusFilter]);

  const handleCopyUpi = (upi: string, id: string) => {
    navigator.clipboard.writeText(upi);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header with Title and Registration Button */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#222226]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Shops Directory & Terminal Kill-Switches
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              店舗 • DIRECTORY
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage terminal subdomains, settlement UPI VPAs, custom surcharges, and emergency kill-switches.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="wabi-btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
        >
          <IconPlus size={14} />
          <span>Register New Shop</span>
        </button>
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
            placeholder="Search by shop name, subdomain slug, UPI VPA, or UUID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#18181b] border border-[#2a2a2e] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white font-sans"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#18181b] border border-[#2a2a2e]">
          {(["all", "active", "suspended"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                statusFilter === filter
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {filter === "all" ? `All (${shops.length})` : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Table Card */}
      <div className="wabi-bento-card rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#222226] bg-[#161618] text-zinc-400 font-mono">
                <th className="py-3.5 px-5 font-normal">Shop Name & UUID</th>
                <th className="py-3.5 px-4 font-normal">Subdomain</th>
                <th className="py-3.5 px-4 font-normal">Settlement UPI</th>
                <th className="py-3.5 px-4 font-normal">Surcharge Rate</th>
                <th className="py-3.5 px-4 font-normal text-center">Kill-Switch</th>
                <th className="py-3.5 px-5 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f23]">
              {filteredShops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400">
                    No shops match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredShops.map((s) => {
                  const shopUrl = getShopCustomerUrl(s);
                  const isSuspended = s.status === "suspended";
                  const customFee = s.total_charge !== undefined ? Number(s.total_charge) : 1.0;

                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition">
                      {/* Name & ID */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-white">{s.name}</div>
                        <div className="font-mono text-[10px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                          <span>{s.id}</span>
                        </div>
                      </td>

                      {/* Subdomain */}
                      <td className="py-3.5 px-4">
                        <a
                          href={shopUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-zinc-300 hover:text-white hover:underline flex items-center gap-1"
                        >
                          <span>{s.slug || s.id.slice(0, 8)}.{ROOT_DOMAIN}</span>
                          <IconExternal size={11} />
                        </a>
                      </td>

                      {/* UPI VPA */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleCopyUpi(s.upi_vpa, s.id)}
                          className="font-mono text-zinc-300 hover:text-white text-left flex items-center gap-1.5 group"
                          title="Click to copy UPI ID"
                        >
                          <span>{s.upi_vpa}</span>
                          <span className="text-[10px] text-zinc-400 group-hover:text-white">
                            {copiedId === s.id ? "✓ Copied" : "📋"}
                          </span>
                        </button>
                      </td>

                      {/* Fee Badge */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-white font-medium">
                          ₹{customFee.toFixed(2)}
                        </span>
                      </td>

                      {/* Kill Switch Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onToggleStatus(s)}
                          className={`px-3 py-1 rounded-full text-[11px] font-mono font-semibold transition ${
                            isSuspended
                              ? "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
                              : "bg-white text-black hover:bg-zinc-200"
                          }`}
                          title="Click to toggle kill-switch"
                        >
                          {isSuspended ? "⛔ Suspended" : "● Active"}
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenEditModal(s)}
                            className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-zinc-300 hover:text-white border border-[#2a2a2e] text-xs transition flex items-center gap-1"
                          >
                            <IconEdit size={11} />
                            <span>Edit</span>
                          </button>
                          <a
                            href={shopUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-white border border-[#2a2a2e] text-xs transition flex items-center gap-1"
                          >
                            <span>Open</span>
                            <IconExternal size={11} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info strip */}
        <div className="p-4 border-t border-[#1f1f23] flex items-center justify-between text-xs text-zinc-400">
          <span>
            Showing {filteredShops.length} of {shops.length} total shops
          </span>
          <span className="font-mono text-zinc-400">
            Direct WebRTC signaling on each subdomain
          </span>
        </div>
      </div>
    </div>
  );
}
