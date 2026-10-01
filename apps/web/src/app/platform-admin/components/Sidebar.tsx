"use client";

import React from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import type { NavigationTab } from "../types";
import {
  IconOverview,
  IconAnalytics,
  IconShops,
  IconLedger,
  IconPricing,
  IconHealth,
  IconPlus,
  IconRefresh,
  IconClose,
} from "./Icons";

interface SidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  shopsCount: number;
  activeCount: number;
  eventsCount: number;
  globalTotalCharge: number;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
  loading: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  shopsCount,
  activeCount,
  eventsCount,
  globalTotalCharge,
  onOpenCreateModal,
  onRefresh,
  loading,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const navItems = [
    {
      id: "overview" as NavigationTab,
      label: "Bento Overview",
      subtext: "Platform Command Deck",
      icon: IconOverview,
      badge: null,
    },
    {
      id: "analytics" as NavigationTab,
      label: "Analytics Suite",
      subtext: "Volume, Yield & Velocity",
      icon: IconAnalytics,
      badge: "Live",
      badgeColor: "bg-[#c59e5e]/15 text-[#d6b070] border-[#c59e5e]/30",
    },
    {
      id: "shops" as NavigationTab,
      label: "Shops Directory",
      subtext: "Counters & Kill-Switch",
      icon: IconShops,
      badge: `${shopsCount}`,
      badgeColor: "bg-[#25221b] text-[#aba293] border-[#383329]",
    },
    {
      id: "ledger" as NavigationTab,
      label: "Print Ledger",
      subtext: "Network Event Stream",
      icon: IconLedger,
      badge: `${eventsCount}`,
      badgeColor: "bg-[#25221b] text-[#aba293] border-[#383329]",
    },
    {
      id: "pricing" as NavigationTab,
      label: "Platform Fee & GST",
      subtext: "Global Surcharge Config",
      icon: IconPricing,
      badge: `₹${globalTotalCharge.toFixed(2)}`,
      badgeColor: "bg-[#528364]/15 text-[#73a886] border-[#528364]/30",
    },
    {
      id: "health" as NavigationTab,
      label: "Topology & Health",
      subtext: "WebRTC Mesh & Routing",
      icon: IconHealth,
      badge: null,
    },
  ];

  const handleSelect = (tab: NavigationTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Rail */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#161411] border-r border-[#2d2922] flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header & Branding */}
        <div>
          <div className="p-5 border-b border-[#26221c] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Wabi-Sabi Tactile Stamp Emblem */}
              <div className="w-10 h-10 rounded-xl bg-[#23201a] border border-[#3d362b] flex items-center justify-center shadow-inner relative group">
                <span className="font-serif text-lg text-[#d96548] font-bold select-none">
                  印
                </span>
                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#528364] ring-2 ring-[#161411]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-[#f4ede4]">
                    Printap
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#2b271f] text-[#aba293] border border-[#3d372b]">
                    CORE
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#8a8174] truncate max-w-[140px]">
                  admin.{ROOT_DOMAIN}
                </div>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[#8a8174] hover:text-[#f4ede4] hover:bg-[#25221b]"
            >
              <IconClose size={18} />
            </button>
          </div>

          {/* Quick Action Button: Register Shop */}
          <div className="p-4 pb-2">
            <button
              onClick={onOpenCreateModal}
              className="w-full py-2.5 px-3 rounded-xl bg-[#26221b] hover:bg-[#322c22] border border-[#3d362b] text-[#f4ede4] text-xs font-medium flex items-center justify-center gap-2 shadow-sm transition group"
            >
              <span className="w-4 h-4 rounded-md bg-[#d96548] text-white flex items-center justify-center text-xs group-hover:scale-105 transition-transform">
                <IconPlus size={12} />
              </span>
              <span>Register New Shop</span>
            </button>
          </div>

          {/* Navigation Section */}
          <div className="px-3 py-3">
            <div className="px-3 pb-2 text-[10px] font-mono font-medium tracking-wider uppercase text-[#736a5c]">
              Control Navigation
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all relative ${
                      isActive
                        ? "bg-[#25211a] text-[#f4ede4] border border-[#3e372b] shadow-inner"
                        : "text-[#aba293] hover:text-[#f4ede4] hover:bg-[#1d1b16] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg transition ${
                          isActive
                            ? "bg-[#2f2a20] text-[#c59e5e]"
                            : "bg-[#1d1b16] text-[#8a8174]"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium leading-none mb-1">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-[#736a5c] leading-none">
                          {item.subtext}
                        </div>
                      </div>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#c59e5e]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Rail: Network Status & Refresh */}
        <div className="p-4 border-t border-[#26221c] bg-[#14120f]/80">
          <div className="p-3 rounded-xl bg-[#1b1914] border border-[#2d2922] mb-3">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-[#8a8174] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#528364] animate-pulse" />
                Signal Mesh
              </span>
              <span className="text-[10px] font-mono text-[#528364] font-semibold">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#aba293]">
              <span className="text-[10px] text-[#736a5c]">Active Counters</span>
              <span className="font-mono text-xs font-semibold text-[#f4ede4]">
                {activeCount} / {shopsCount}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-[#736a5c]">
              v1.4 • 侘寂 (Wabi)
            </div>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg bg-[#201d17] hover:bg-[#2c2820] text-[#aba293] hover:text-[#f4ede4] border border-[#332e25] text-xs transition flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh platform data"
            >
              <span className={loading ? "animate-spin" : ""}>
                <IconRefresh size={13} />
              </span>
              <span className="text-[11px]">Sync</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
