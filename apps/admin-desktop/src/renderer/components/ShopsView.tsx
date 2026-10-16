import React, { useState, useMemo } from "react";
import { ROOT_DOMAIN, getShopCustomerUrl } from "@printap/shared";
import type { ExtendedShop } from "../types";
import {
  IconSearch,
  IconExternal,
  IconEdit,
  IconTrash,
} from "./Icons";

interface ShopsViewProps {
  shops: ExtendedShop[];
  onOpenEditModal: (shop: ExtendedShop) => void;
  onOpenDeleteModal: (shop: ExtendedShop) => void;
  onToggleStatus: (shop: ExtendedShop) => void;
  globalPlatformFee: number;
}

export function ShopsView({
  shops,
  onOpenEditModal,
  onOpenDeleteModal,
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
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-black tracking-tight">
              Shops Directory & Terminal Kill-Switches
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              DIRECTORY
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Manage terminal subdomains, settlement UPI VPAs, custom surcharges, and emergency kill-switches.
          </p>
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
            placeholder="Search by shop name, subdomain slug, UPI VPA, or UUID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-black placeholder-zinc-400 focus:outline-none focus:border-black font-sans"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 border border-zinc-200">
          {(["all", "active", "suspended"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                statusFilter === filter
                  ? "bg-black text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:text-black"
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
              <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-mono">
                <th className="py-3.5 px-5 font-normal">Shop Name & UUID</th>
                <th className="py-3.5 px-4 font-normal">Subdomain</th>
                <th className="py-3.5 px-4 font-normal">Settlement UPI</th>
                <th className="py-3.5 px-4 font-normal">Surcharge Rate</th>
                <th className="py-3.5 px-4 font-normal text-center">Kill-Switch</th>
                <th className="py-3.5 px-5 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
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
                    <tr key={s.id} className="hover:bg-zinc-50/70 transition">
                      {/* Name & ID */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-black">{s.name}</div>
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
                          className="font-mono text-zinc-700 hover:text-black hover:underline flex items-center gap-1 font-medium"
                        >
                          <span>{s.slug || s.id.slice(0, 8)}.{ROOT_DOMAIN}</span>
                          <IconExternal size={11} />
                        </a>
                      </td>

                      {/* UPI VPA */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleCopyUpi(s.upi_vpa, s.id)}
                          className="font-mono text-zinc-700 hover:text-black text-left flex items-center gap-1.5 group"
                          title="Click to copy UPI ID"
                        >
                          <span>{s.upi_vpa}</span>
                          <span className="text-[10px] text-zinc-400 group-hover:text-black">
                            {copiedId === s.id ? "✓ Copied" : "📋"}
                          </span>
                        </button>
                      </td>

                      {/* Fee Badge */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-black font-semibold">
                          ₹{customFee.toFixed(2)}
                        </span>
                      </td>

                      {/* Kill Switch Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onToggleStatus(s)}
                          className={`px-3 py-1 rounded-full text-[11px] font-mono font-semibold transition ${
                            isSuspended
                              ? "bg-zinc-200 text-zinc-700 border border-zinc-300 hover:bg-zinc-300"
                              : "bg-black text-white hover:bg-zinc-800"
                          }`}
                          title="Click to toggle kill-switch"
                        >
                          {isSuspended ? "⛔ Suspended" : "● Active"}
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenEditModal(s)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border border-zinc-200 text-xs transition flex items-center gap-1 font-medium"
                            title="Edit shop details"
                          >
                            <IconEdit size={11} />
                            <span>Edit</span>
                          </button>
                          <a
                            href={shopUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-black border border-zinc-200 text-xs transition flex items-center gap-1 font-medium"
                            title="Open customer counter"
                          >
                            <span>Open</span>
                            <IconExternal size={11} />
                          </a>
                          <button
                            onClick={() => onOpenDeleteModal(s)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-200 text-xs transition flex items-center gap-1 font-medium cursor-pointer"
                            title="Offboard shop and wipe Google Auth credentials"
                          >
                            <IconTrash size={11} />
                            <span>Offboard</span>
                          </button>
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
        <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
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
