"use client";

import React from "react";
import {
  DashboardIcon,
  AnalyticsIcon,
  StoreIcon,
  LedgerIcon,
  PricingIcon,
  HealthIcon,
  PlusIcon,
  RefreshIcon,
  ExternalLinkIcon,
  CloseIcon,
} from "./AdminIcons";
import { ROOT_DOMAIN, SHOP_ADMIN_URL } from "@printap/shared";

export type AdminTab = "overview" | "analytics" | "shops" | "ledger" | "pricing" | "health";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  shopsCount: number;
  eventsCount: number;
  globalTotalCharge: number;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export function AdminSidebar({
  activeTab,
  onSelectTab,
  shopsCount,
  eventsCount,
  globalTotalCharge,
  onOpenCreateModal,
  onRefresh,
  isRefreshing,
  isOpenMobile,
  onCloseMobile,
}: AdminSidebarProps) {
  const navItems = [
    {
      id: "overview" as AdminTab,
      label: "Bento Overview",
      description: "Platform pulse & command",
      icon: DashboardIcon,
      badge: null,
    },
    {
      id: "analytics" as AdminTab,
      label: "Analytics & Trends",
      description: "Revenue, volume & velocity",
      icon: AnalyticsIcon,
      badge: "Deep",
      badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    },
    {
      id: "shops" as AdminTab,
      label: "Shops & Kill-Switch",
      description: "Terminal directory & controls",
      icon: StoreIcon,
      badge: String(shopsCount),
      badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    {
      id: "ledger" as AdminTab,
      label: "Global Print Ledger",
      description: "Live print session audit",
      icon: LedgerIcon,
      badge: String(eventsCount),
      badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    },
    {
      id: "pricing" as AdminTab,
      label: "Fee & GST Engine",
      description: "Global convenience rates",
      icon: PricingIcon,
      badge: `₹${globalTotalCharge.toFixed(2)}`,
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    {
      id: "health" as AdminTab,
      label: "System & Routing",
      description: "Network health & domains",
      icon: HealthIcon,
      badge: "P2P",
      badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between pb-5 border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Printap"
                className="w-10 h-10 rounded-2xl object-cover shadow-md border border-black/10"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-[--color-foreground]">
                  Printap
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-black/5 text-[--color-muted] border border-black/[0.06]">
                  Admin
                </span>
              </div>
              <div className="text-[11px] font-mono text-[--color-muted] truncate max-w-[130px]">
                admin.{ROOT_DOMAIN}
              </div>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-xl text-[--color-muted] hover:text-[--color-foreground] hover:bg-black/5 transition"
            aria-label="Close navigation"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Button */}
        <div className="mt-4 mb-5">
          <button
            onClick={() => {
              onOpenCreateModal();
              onCloseMobile();
            }}
            className="w-full btn-primary py-2.5 px-3.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 group transition-all"
          >
            <PlusIcon className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            <span>Register New Shop</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[--color-muted] px-3 mb-2">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center justify-between transition-all duration-200 group relative ${
                  isActive
                    ? "glass-strong text-[--color-foreground] shadow-md border-black/10"
                    : "text-[--color-muted] hover:text-[--color-foreground] hover:bg-white/60 hover:backdrop-blur-md"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-xl transition-colors ${
                      isActive
                        ? "bg-black text-white"
                        : "bg-black/[0.04] text-[--color-muted] group-hover:text-[--color-foreground] group-hover:bg-black/[0.08]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold leading-tight">{item.label}</div>
                    <div className="text-[10px] text-[--color-muted] truncate leading-tight">
                      {item.description}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      item.badgeColor || "bg-black/5 text-[--color-muted] border-black/10"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-black rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="pt-4 border-t border-black/[0.06] space-y-3">
        {/* System connectivity status pill */}
        <div className="glass-panel-subtle p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <div className="text-[11px] font-semibold text-[--color-foreground]">Network Live</div>
              <div className="text-[9px] text-[--color-muted]">Zero Cloud Storage</div>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-xl text-[--color-muted] hover:text-[--color-foreground] hover:bg-black/5 transition"
            title="Refresh platform data"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Quick Portal Switcher */}
        <div className="flex items-center justify-between text-[11px] text-[--color-muted] px-1">
          <a
            href={SHOP_ADMIN_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-indigo-600 transition"
          >
            <span>Shop Terminal</span>
            <ExternalLinkIcon className="w-2.5 h-2.5" />
          </a>
          <span className="text-black/20">•</span>
          <a
            href={`https://${ROOT_DOMAIN}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-indigo-600 transition"
          >
            <span>Landing</span>
            <ExternalLinkIcon className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 h-[calc(100vh-2rem)] sticky top-4 glass-panel rounded-3xl p-5 shadow-lg border border-white/80 z-20 overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full glass-strong p-5 shadow-2xl z-10 animate-fade-in-up">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
