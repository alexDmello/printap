"use client";

import React, { useState } from "react";
import {
  SearchIcon,
  PlusIcon,
  PowerIcon,
  PencilIcon,
  ExternalLinkIcon,
  GridIcon,
  TableIcon,
  StoreIcon,
} from "./AdminIcons";
import { ROOT_DOMAIN, getShopCustomerUrl } from "@printap/shared";
import type { ExtendedShop } from "./BentoOverview";

interface ShopsDirectoryViewProps {
  shops: ExtendedShop[];
  search: string;
  onSearchChange: (val: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (shop: ExtendedShop) => void;
  onToggleStatus: (shop: ExtendedShop) => void;
}

type StatusFilter = "all" | "active" | "suspended";
type ViewMode = "grid" | "table";

export function ShopsDirectoryView({
  shops,
  search,
  onSearchChange,
  onOpenCreateModal,
  onOpenEditModal,
  onToggleStatus,
}: ShopsDirectoryViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredShops = shops.filter((s) => {
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

  const activeCount = shops.filter((s) => s.status === "active").length;
  const suspendedCount = shops.filter((s) => s.status === "suspended").length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Control Bar: Search, Filters & View Toggle ─── */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4 border border-white/80">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[--color-muted]" />
            <input
              type="text"
              placeholder="Search by shop name, subdomain, UPI VPA, or UUID..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-panel-subtle border border-black/[0.08] text-xs text-[--color-foreground] placeholder-[--color-muted] focus:outline-none focus:border-black transition"
            />
          </div>

          {/* Filter Pills */}
          <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-2xl bg-black/[0.04]">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                statusFilter === "all"
                  ? "bg-white text-[--color-foreground] shadow-sm"
                  : "text-[--color-muted]"
              }`}
            >
              All ({shops.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                statusFilter === "active"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-[--color-muted]"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("suspended")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                statusFilter === "suspended"
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-[--color-muted]"
              }`}
            >
              Suspended ({suspendedCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-2xl bg-black/[0.04]">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-xl transition ${
                viewMode === "grid" ? "bg-white shadow-sm text-black" : "text-[--color-muted]"
              }`}
              title="Bento Grid View"
            >
              <GridIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-xl transition ${
                viewMode === "table" ? "bg-white shadow-sm text-black" : "text-[--color-muted]"
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onOpenCreateModal}
            className="btn-primary px-3.5 py-2 rounded-2xl text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Add Shop</span>
          </button>
        </div>
      </div>

      {/* ─── Bento Grid View ─── */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredShops.length === 0 ? (
            <div className="col-span-full glass-panel rounded-3xl p-12 text-center text-xs text-[--color-muted]">
              No shops match your criteria.
            </div>
          ) : (
            filteredShops.map((shop) => {
              const shopUrl = getShopCustomerUrl(shop);
              const isSuspended = shop.status === "suspended";

              return (
                <div
                  key={shop.id}
                  className="glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between relative group"
                >
                  <div>
                    {/* Top Row: Shop Name & Status Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-[--color-foreground] truncate">
                          {shop.name}
                        </h4>
                        <a
                          href={shopUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-indigo-500 hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          <span>{shop.slug || shop.id.slice(0, 8)}.{ROOT_DOMAIN}</span>
                          <ExternalLinkIcon className="w-3 h-3" />
                        </a>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                          isSuspended
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        }`}
                      >
                        {isSuspended ? "Suspended" : "Active"}
                      </span>
                    </div>

                    {/* Metadata Bento Section */}
                    <div className="p-3 rounded-2xl bg-black/[0.03] space-y-2 text-xs mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[--color-muted]">UPI VPA:</span>
                        <span className="font-mono font-medium text-[--color-foreground] truncate max-w-[170px]">
                          {shop.upi_vpa}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[--color-muted]">Total Prints:</span>
                        <span className="font-mono font-bold text-indigo-600">
                          {shop.printCount || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[--color-muted]">Platform Fee:</span>
                        <span className="font-mono font-semibold text-[--color-foreground]">
                          ₹{Number(shop.total_charge || 1).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-[--color-muted] truncate mb-4">
                      UUID: {shop.id}
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between gap-2">
                    <button
                      onClick={() => onToggleStatus(shop)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                        isSuspended
                          ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20"
                          : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20"
                      }`}
                      title="Toggle Terminal Kill-Switch"
                    >
                      <PowerIcon className="w-3.5 h-3.5" />
                      <span>{isSuspended ? "Reactivate" : "Kill-Switch"}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenEditModal(shop)}
                        className="p-2 rounded-xl glass-panel-subtle hover:bg-white text-[--color-foreground] border border-black/5 transition"
                        title="Edit Shop Details"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={shopUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold glass-panel-subtle hover:bg-white text-indigo-600 border border-indigo-500/20 flex items-center gap-1 transition"
                      >
                        <span>Counter</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ─── Table View ─── */
        <div className="glass-panel rounded-3xl overflow-hidden border border-white/90">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] bg-black/[0.02] text-[--color-muted]">
                  <th className="py-3.5 px-5 font-semibold">Shop Name & UUID</th>
                  <th className="py-3.5 px-5 font-semibold">Subdomain</th>
                  <th className="py-3.5 px-5 font-semibold">Settlement UPI</th>
                  <th className="py-3.5 px-5 font-semibold text-center">Prints</th>
                  <th className="py-3.5 px-5 font-semibold">Status / Kill-Switch</th>
                  <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredShops.map((shop) => {
                  const shopUrl = getShopCustomerUrl(shop);
                  const isSuspended = shop.status === "suspended";

                  return (
                    <tr key={shop.id} className="hover:bg-black/[0.02] transition">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[--color-foreground]">{shop.name}</div>
                        <div className="font-mono text-[10px] text-[--color-muted]">{shop.id}</div>
                      </td>

                      <td className="py-3.5 px-5">
                        <a
                          href={shopUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-indigo-500 hover:underline flex items-center gap-1"
                        >
                          <span>{shop.slug || shop.id.slice(0, 8)}.{ROOT_DOMAIN}</span>
                          <ExternalLinkIcon className="w-2.5 h-2.5" />
                        </a>
                      </td>

                      <td className="py-3.5 px-5 font-mono text-[--color-foreground]/90">
                        {shop.upi_vpa}
                      </td>

                      <td className="py-3.5 px-5 text-center font-mono font-bold">
                        {shop.printCount || 0}
                      </td>

                      <td className="py-3.5 px-5">
                        <button
                          onClick={() => onToggleStatus(shop)}
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                            isSuspended
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
                          }`}
                        >
                          {isSuspended ? "⛔ Suspended (Click to resume)" : "● Active (Click to suspend)"}
                        </button>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenEditModal(shop)}
                            className="px-2.5 py-1.5 rounded-xl glass-panel-subtle hover:bg-white text-xs border border-black/5 transition"
                          >
                            Edit
                          </button>
                          <a
                            href={shopUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 rounded-xl glass-panel-subtle hover:bg-white text-xs text-indigo-600 border border-indigo-500/20 transition"
                          >
                            Counter
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
