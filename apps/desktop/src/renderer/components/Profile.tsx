import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getShopCustomerUrl } from "@printap/shared";
import { IconCopy, IconCheck, IconQr, IconShield } from "./Icons";

interface ProfileProps {
  onNavigateToQr?: () => void;
  isTerminalOnline?: boolean;
}

export const Profile: React.FC<ProfileProps> = React.memo(({ onNavigateToQr, isTerminalOnline = false }) => {
  const { shop } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>(() => {
    if (typeof __APP_VERSION__ !== "undefined") {
      return __APP_VERSION__;
    }
    return "0.3.20";
  });

  React.useEffect(() => {
    let isMounted = true;
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI
        .getAppVersion()
        .then((ver) => {
          if (isMounted && ver) {
            setAppVersion(ver);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!window.electronAPI?.onUpdaterEvent) return;
    const unsubscribe = window.electronAPI.onUpdaterEvent((event) => {
      if (event.stage === "checking") {
        setIsCheckingUpdate(true);
      } else if (event.stage === "not-available") {
        setIsCheckingUpdate(false);
        setUpdateMessage(`✓ Printap v${appVersion} is up to date`);
      } else if (event.stage === "available") {
        setIsCheckingUpdate(false);
        setUpdateMessage("Update available! Downloading mandatory update...");
      } else if (event.stage === "downloading") {
        setUpdateMessage(`Downloading update... ${Math.round(event.progress || 0)}%`);
      } else if (event.stage === "downloaded") {
        setUpdateMessage("Update downloaded. Restarting application to apply...");
      } else if (event.stage === "error") {
        setIsCheckingUpdate(false);
        setUpdateMessage("Update check failed — please check connection");
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [appVersion]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const customerUrl = getShopCustomerUrl(shop, shop?.name || "shop");

  return (
    <div className="content fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <span>Shop Profile</span>
          <span className="tech-tag active">Verified Shop</span>
        </h1>
        <p className="page-subtitle">
          Counter metadata, UPI settlement address, and terminal identity.
        </p>
      </div>

      {/* Primary Information */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header">
          <div className="card-title">Identity & Details</div>
          <span className="status-badge active">● Active & Verified</span>
        </div>
        <div className="card-body">
          <div className="profile-field">
            <span className="profile-field-label">Shop Name</span>
            <span className="profile-field-value">{shop?.name || "Test Shop"}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">UPI Settlement VPA</span>
            <span
              className="profile-field-value"
              style={{ fontFamily: "inherit" }}
            >
              {shop?.upi_vpa || "shop@upi"}
            </span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Terminal Status</span>
            <span
              className="profile-field-value"
              style={{
                color: isTerminalOnline ? "var(--accent-emerald)" : "var(--text-muted)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: isTerminalOnline ? "var(--accent-emerald)" : "#a1a1aa",
                  boxShadow: isTerminalOnline ? "0 0 6px rgba(16, 185, 129, 0.4)" : "none",
                  display: "inline-block",
                }}
              />
              {isTerminalOnline
                ? "Terminal Online — Ready for incoming prints"
                : "Terminal Offline — Counter paused (Toggle in menu)"}
            </span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Registration Date</span>
            <span className="profile-field-value">
              {shop?.created_at
                ? new Date(shop.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "September 2026"}
            </span>
          </div>
        </div>
      </div>

      {/* Customer Web URL */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header">
          <div className="card-title">Customer Print URL</div>
          <span className="tech-tag">Direct P2P</span>
        </div>
        <div className="card-body">
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Customer Print URL
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                readOnly
                value={customerUrl}
                className="login-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => customerUrl && copyToClipboard(customerUrl, "url")}
              >
                {copiedKey === "url" ? (
                  <>
                    <IconCheck size={14} color="var(--accent-emerald)" />
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={14} />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Encoded into your physical counter QR code. Customers open this link directly in their mobile browser to send PDFs without sharing phone numbers or emails.
            </p>

            {onNavigateToQr && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="login-btn"
                  style={{ width: "auto", padding: "9px 20px", fontSize: 12 }}
                  onClick={onNavigateToQr}
                >
                  <IconQr size={14} />
                  <span>Open Counter QR Stand →</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Software Updates & Release Channel */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header">
          <div className="card-title">Terminal Software & Updates</div>
          <span className="status-badge active">● Production Channel</span>
        </div>
        <div className="card-body">
          <div className="profile-field">
            <span className="profile-field-label">Installed Version</span>
            <span className="profile-field-value">v{appVersion}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Update Status</span>
            <span
              className="profile-field-value"
              style={{
                color: updateMessage?.includes("failed")
                  ? "var(--accent-rose, #f43f5e)"
                  : updateMessage?.includes("available")
                  ? "var(--accent-indigo, #6366f1)"
                  : "var(--accent-emerald)",
                fontWeight: 600,
              }}
            >
              {isCheckingUpdate ? "Checking release server..." : updateMessage || "Automatic checks active on startup"}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="pill-btn"
              disabled={isCheckingUpdate}
              onClick={async () => {
                setIsCheckingUpdate(true);
                setUpdateMessage(null);
                try {
                  if (window.electronAPI?.checkForUpdates) {
                    const res = await window.electronAPI.checkForUpdates();
                    if (res?.isDev) {
                      setUpdateMessage(`Printap v${appVersion} is up to date (Development mode)`);
                    } else if (res?.isLatest) {
                      setUpdateMessage(`✓ Printap v${res.currentVersion || appVersion} is up to date`);
                    } else if (res?.latestVersion && res.latestVersion !== appVersion) {
                      setUpdateMessage(`Update available: v${res.latestVersion}. Downloading compulsory update...`);
                    } else if (res?.success === false) {
                      setUpdateMessage(res.error ? `Check failed: ${res.error}` : "Check failed — verify internet connection");
                    } else {
                      setUpdateMessage(`✓ Printap v${appVersion} is up to date`);
                    }
                  } else {
                    setUpdateMessage(`✓ Printap v${appVersion} is up to date`);
                  }
                } catch {
                  setUpdateMessage("Check failed — verify internet connection");
                } finally {
                  setTimeout(() => setIsCheckingUpdate(false), 1200);
                }
              }}
            >
              <span>{isCheckingUpdate ? "Connecting to Release Server..." : "Check for Updates Now"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security Architecture Badge */}
      <div
        className="card"
        style={{
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 6,
          }}
        >
          <IconShield size={16} color="var(--accent-emerald)" />
          <span>Zero-Liability Privacy Architecture</span>
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          The terminal operates entirely peer-to-peer over encrypted WebRTC connections. Documents are never stored on any cloud server or accessible to third parties. Once spooled to your hardware printer, temporary memory buffers are destroyed immediately.
        </p>
      </div>

      {/* Legal & Compliance Links */}
      <div
        className="card"
        style={{
          padding: 20,
          marginTop: 22,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Legal &amp; Compliance
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          Printap operates in accordance with the Information Technology Act, 2000 and Consumer Protection (E-Commerce) Rules, 2020.
        </p>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <a
            href="https://mellod.in/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "underline" }}
          >
            Terms of Service
          </a>
          <a
            href="https://mellod.in/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "underline" }}
          >
            Privacy Policy
          </a>
          <a
            href="https://mellod.in/refund-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "underline" }}
          >
            Refund Policy
          </a>
          <a
            href="https://mellod.in/contact"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "underline" }}
          >
            Grievance Officer
          </a>
        </div>
      </div>
    </div>
  );
});
