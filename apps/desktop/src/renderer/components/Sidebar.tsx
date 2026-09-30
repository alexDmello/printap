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
  isOnline: boolean;
  onToggleOnline: (value: boolean) => void;
  isTogglingOnline?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  isOnline,
  onToggleOnline,
  isTogglingOnline = false,
}) => {
  const { shop, logout } = useAuth();
  const [showOfflineConfirm, setShowOfflineConfirm] = React.useState(false);

  const handleToggleClick = () => {
    if (isTogglingOnline) return;
    if (isOnline) {
      setShowOfflineConfirm(true);
    } else {
      onToggleOnline(true);
    }
  };

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
    <>
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
                <span className={`beacon-dot ${isOnline ? "online" : "offline"}`} />
                <span>{isOnline ? "Portal Online" : "Portal Offline"}</span>
              </div>
            </div>
          </div>

          {/* Online / Offline Presence Toggle */}
          <div className={`sidebar-online-card ${isOnline ? "online" : "offline"}`}>
            <div className="sidebar-online-header">
              <div className="sidebar-online-label-group">
                <div className="sidebar-online-text">
                  <span className="sidebar-online-title">
                    {isOnline ? "Accepting Jobs" : "Shop Offline"}
                  </span>
                  <span className="sidebar-online-subtitle">
                    {isOnline ? "Customers can print" : "Website is offline"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={`toggle-switch-btn ${isOnline ? "checked" : ""} ${
                  isTogglingOnline ? "loading" : ""
                }`}
                onClick={handleToggleClick}
                disabled={isTogglingOnline}
                aria-label={isOnline ? "Go offline" : "Go online"}
                title={isOnline ? "Switch shop to offline" : "Switch shop to online"}
              >
                <span className="toggle-switch-knob">
                  {isTogglingOnline && <span className="toggle-spinner" />}
                </span>
              </button>
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

      {showOfflineConfirm && (
        <div className="modal-overlay" onClick={() => setShowOfflineConfirm(false)}>
          <div
            className="confirm-dialog-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-dialog-title">Switch Shop to Offline?</div>
            <div className="confirm-dialog-body">
              Going offline will prevent new customers from uploading or printing from your website. Any orders already in progress will complete normally.
            </div>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn-dialog-cancel"
                onClick={() => setShowOfflineConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-dialog-confirm"
                onClick={() => {
                  setShowOfflineConfirm(false);
                  onToggleOnline(false);
                }}
              >
                Go Offline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
