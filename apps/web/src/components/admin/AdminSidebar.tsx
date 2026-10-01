import React from "react";
import type { ShopInfo } from "@printap/shared";
import {
  IconOverview,
  IconAnalytics,
  IconServices,
  IconQr,
  IconPrinter,
  IconProfile,
  IconLogout,
  IconCopy,
  IconCheck,
  IconExternal,
  IconClose,
} from "./AdminIcons";

export type AdminTab = "overview" | "analytics" | "services" | "qr" | "printers" | "profile";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  shop: ShopInfo;
  customerUrl: string;
  activePrintersCount: number;
  totalPrintsCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogoutRequest: () => void;
  copiedLink: boolean;
  onCopyLink: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  shop,
  customerUrl,
  activePrintersCount,
  totalPrintsCount,
  isOpenMobile,
  onCloseMobile,
  onLogoutRequest,
  copiedLink,
  onCopyLink,
}) => {
  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <IconOverview size={18} />,
    },
    {
      id: "analytics",
      label: "Analytics & Ledger",
      icon: <IconAnalytics size={18} />,
      badge: totalPrintsCount > 0 ? `${totalPrintsCount}` : undefined,
      badgeColor: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20",
    },
    {
      id: "services",
      label: "Services & Rates",
      icon: <IconServices size={18} />,
    },
    {
      id: "qr",
      label: "Counter QR Stand",
      icon: <IconQr size={18} />,
    },
    {
      id: "printers",
      label: "Printers Control",
      icon: <IconPrinter size={18} />,
      badge: activePrintersCount > 0 ? `${activePrintersCount} live` : undefined,
      badgeColor: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
    },
    {
      id: "profile",
      label: "Shop Profile",
      icon: <IconProfile size={18} />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 flex flex-col bg-white/80 backdrop-blur-2xl border-r border-slate-200/80 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.03)] transition-transform duration-300 ease-out lg:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header / Brand */}
        <div className="p-5 border-b border-slate-200/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[1px] shadow-sm shadow-indigo-500/20 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Printap"
                  className="w-full h-full object-cover rounded-[11px]"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 tracking-tight">Printap</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200/60">
                    Counter
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Shop Admin Portal</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close navigation"
            >
              <IconClose size={18} />
            </button>
          </div>

          {/* Shop Card with Status Beacon */}
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h2
                className="text-xs font-bold text-slate-900 truncate"
                title={shop.name}
              >
                {shop.name}
              </h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>

            {/* Customer Link Preview & Copy */}
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
              <span className="text-slate-500 truncate font-mono text-[10px]">
                {customerUrl.replace(/^https?:\/\//, "")}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={onCopyLink}
                  title="Copy customer print link"
                  className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white transition border border-transparent hover:border-slate-200"
                >
                  {copiedLink ? (
                    <IconCheck size={13} className="text-emerald-600" />
                  ) : (
                    <IconCopy size={13} />
                  )}
                </button>
                <a
                  href={customerUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open customer link in new tab"
                  className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white transition border border-transparent hover:border-slate-200"
                >
                  <IconExternal size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Counter Management
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={
                      isActive
                        ? "text-indigo-300"
                        : "text-slate-400 group-hover:text-slate-600"
                    }
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white border border-white/20"
                        : item.badgeColor || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Help / P2P Note */}
        <div className="p-3 mx-3 mb-3 rounded-xl bg-gradient-to-br from-indigo-50/50 to-purple-50/30 border border-indigo-100/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 mb-1">
            <span>🛡️</span> Zero Cloud Storage
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            All customer documents are transferred directly over encrypted peer-to-peer WebRTC and auto-shredded upon spooling.
          </p>
        </div>

        {/* Sidebar Footer with Logout */}
        <div className="p-3 border-t border-slate-200/60 bg-white/40">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Terminal ID
              </p>
              <p className="text-[11px] font-mono text-slate-700 truncate" title={shop.id}>
                {shop.id.slice(0, 8)}...{shop.id.slice(-4)}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogoutRequest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200/60 transition"
              title="Disconnect shop terminal"
            >
              <IconLogout size={14} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
