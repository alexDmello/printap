import React from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import logoImg from "../assets/logo.png";
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
      badgeColor: "",
    },
    {
      id: "analytics" as NavigationTab,
      label: "Analytics Suite",
      subtext: "Volume, Yield & Velocity",
      icon: IconAnalytics,
      badge: "LIVE",
      badgeColor: "bg-black text-white border-black",
    },
    {
      id: "shops" as NavigationTab,
      label: "Shops Directory",
      subtext: "Counters & Kill-Switch",
      icon: IconShops,
      badge: `${shopsCount}`,
      badgeColor: "bg-zinc-100 text-zinc-800 border-zinc-200",
    },
    {
      id: "ledger" as NavigationTab,
      label: "Print Ledger",
      subtext: "Network Event Stream",
      icon: IconLedger,
      badge: `${eventsCount}`,
      badgeColor: "bg-zinc-100 text-zinc-800 border-zinc-200",
    },
    {
      id: "pricing" as NavigationTab,
      label: "Platform Fee & GST",
      subtext: "Global Surcharge Config",
      icon: IconPricing,
      badge: `₹${globalTotalCharge.toFixed(2)}`,
      badgeColor: "bg-zinc-100 text-zinc-900 border-zinc-300 font-semibold",
    },
    {
      id: "health" as NavigationTab,
      label: "Topology & Health",
      subtext: "WebRTC Mesh & Routing",
      icon: IconHealth,
      badge: null,
      badgeColor: "",
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
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Rail */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-zinc-200 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header & Branding */}
        <div>
          <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Black Seal Emblem with P.png Logo */}
              <div className="w-10 h-10 rounded-xl bg-black border border-zinc-800 p-1.5 flex items-center justify-center shadow-md relative group overflow-hidden">
                <img
                  src={logoImg}
                  alt="Printap Logo"
                  className="w-full h-full object-contain select-none"
                />
                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-black ring-2 ring-white" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-black">
                    Printap
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                    CORE
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500 truncate max-w-[140px]">
                  Executive Desktop App
                </div>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100"
            >
              <IconClose size={18} />
            </button>
          </div>

          {/* Quick Action Button: Register Shop */}
          <div className="p-4 pb-2">
            <button
              onClick={onOpenCreateModal}
              className="w-full py-2.5 px-3 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition group"
            >
              <span className="w-4 h-4 rounded-md bg-white text-black flex items-center justify-center text-xs group-hover:scale-105 transition-transform">
                <IconPlus size={12} />
              </span>
              <span>Register New Shop</span>
            </button>
          </div>

          {/* Navigation Section */}
          <div className="px-3 py-3">
            <div className="px-3 pb-2 text-[10px] font-mono font-medium tracking-wider uppercase text-zinc-400">
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
                        ? "bg-zinc-100 text-black border border-zinc-200 shadow-xs font-medium"
                        : "text-zinc-600 hover:text-black hover:bg-zinc-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg transition ${
                          isActive
                            ? "bg-black text-white"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium leading-none mb-1">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-zinc-400 leading-none">
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
                      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-black" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Rail: Network Status & Refresh */}
        <div className="p-4 border-t border-zinc-100 bg-white">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 mb-3">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-zinc-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                Signal Mesh
              </span>
              <span className="text-[10px] font-mono text-black font-semibold">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-700">
              <span className="text-[10px] text-zinc-500">Active Counters</span>
              <span className="font-mono text-xs font-semibold text-black">
                {activeCount} / {shopsCount}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-zinc-400">
              v1.4 • WHITE & BLACK
            </div>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border border-zinc-200 text-xs transition flex items-center gap-1.5 disabled:opacity-50"
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
