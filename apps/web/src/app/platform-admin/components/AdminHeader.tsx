"use client";

import React from "react";
import { MenuIcon, PlusIcon, RefreshIcon, ExternalLinkIcon } from "./AdminIcons";
import { ROOT_DOMAIN } from "@printap/shared";
import type { AdminTab } from "./AdminSidebar";

interface AdminHeaderProps {
  activeTab: AdminTab;
  onOpenMobileNav: () => void;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalShops: number;
}

const TAB_TITLES: Record<AdminTab, { title: string; subtitle: string }> = {
  overview: {
    title: "Platform Command Center",
    subtitle: "Real-time metrics, network pulse & bento controls",
  },
  analytics: {
    title: "Platform Analytics & Revenue",
    subtitle: "Financial distributions, print velocity & terminal performance",
  },
  shops: {
    title: "Shops Directory & Kill-Switch",
    subtitle: "Instant terminal kill-switch, subdomains & routing registry",
  },
  ledger: {
    title: "Global Print Ledger",
    subtitle: "Real-time WebRTC session stream & platform fee receipts",
  },
  pricing: {
    title: "Fee & GST Pricing Engine",
    subtitle: "Global convenience charge, tax rates & terminal propagation",
  },
  health: {
    title: "System Architecture & Routing",
    subtitle: "Subdomain network topology, WebRTC signaling & health",
  },
};

export function AdminHeader({
  activeTab,
  onOpenMobileNav,
  onOpenCreateModal,
  onRefresh,
  isRefreshing,
  totalShops,
}: AdminHeaderProps) {
  const meta = TAB_TITLES[activeTab] || TAB_TITLES.overview;

  return (
    <header className="glass-panel rounded-3xl p-4 sm:p-5 mb-6 shadow-sm border border-white/80 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="md:hidden p-2 rounded-2xl glass hover:bg-black/5 text-[--color-foreground] transition"
          aria-label="Open navigation menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-[--color-foreground] tracking-tight">
              {meta.title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Mesh
            </span>
          </div>
          <p className="text-xs text-[--color-muted] mt-0.5">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="glass-panel-subtle hover:bg-white px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-[--color-muted] hover:text-[--color-foreground] transition flex items-center gap-2 border border-black/5"
          title="Refresh network data"
        >
          <RefreshIcon className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
          <span className="hidden sm:inline">{isRefreshing ? "Syncing..." : "Sync"}</span>
        </button>

        <button
          onClick={onOpenCreateModal}
          className="btn-primary px-4 py-2.5 rounded-2xl text-xs font-semibold text-white shadow-md flex items-center gap-2"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>New Shop</span>
        </button>
      </div>
    </header>
  );
}
