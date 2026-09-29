import React from "react";
import { useAuth } from "../context/AuthContext";
import {
  IconLive,
  IconPrinter,
  IconAnalytics,
  IconProfile,
  IconLogout,
  IconQr,
  IconTag,
} from "./Icons";

export type AdminPage = "live" | "printers" | "services" | "analytics" | "qr" | "profile";

interface SidebarProps {
  currentPage: AdminPage;
  onSelectPage: (page: AdminPage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
}) => {
  const { shop, logout } = useAuth();

  const navItems: { id: AdminPage; label: string; icon: React.ReactNode }[] = [
    {
      id: "live",
      label: "Live Monitor",
      icon: <IconLive size={18} className="sidebar-item-icon" />,
    },
    {
      id: "printers",
      label: "Printers Control",
      icon: <IconPrinter size={18} className="sidebar-item-icon" />,
    },
    {
      id: "services",
      label: "Services & Rates",
      icon: <IconTag size={18} className="sidebar-item-icon" />,
    },
    {
      id: "analytics",
      label: "Revenue & Analytics",
      icon: <IconAnalytics size={18} className="sidebar-item-icon" />,
    },
    {
      id: "qr",
      label: "Counter QR Stand",
      icon: <IconQr size={18} className="sidebar-item-icon" />,
    },
    {
      id: "profile",
      label: "Shop Profile",
      icon: <IconProfile size={18} className="sidebar-item-icon" />,
    },
  ];

  const shopInitials = shop?.name
    ? shop.name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "PS";

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-badge">
          <IconPrinter size={18} color="#ffffff" />
        </div>
        <div>
          <div className="brand-title">
            <span>Printap</span>
            <span className="brand-sub">Agent</span>
          </div>
        </div>
      </div>

      {/* Clean Nav List */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => onSelectPage(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Profile & Terminal Gateway */}
      <div className="sidebar-footer">
        <div className="sidebar-shop-info">
          <div className="sidebar-avatar">{shopInitials}</div>
          <div className="sidebar-shop-meta">
            <div className="sidebar-shop-name" title={shop?.name || "Shop Agent"}>
              {shop?.name || "Print Shop"}
            </div>
            <div className="sidebar-status-beacon">
              <span className="beacon-dot" />
              <span>Direct P2P Ready</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={logout}
          title="Sign out of this shop terminal"
        >
          <span>Disconnect Terminal</span>
          <IconLogout size={13} />
        </button>
      </div>
    </aside>
  );
};
