import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getShopCustomerUrl } from "@printap/shared";
import { IconCopy, IconCheck, IconQr, IconShield } from "./Icons";

interface ProfileProps {
  onNavigateToQr?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onNavigateToQr }) => {
  const { shop, shopId } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
          Counter metadata, UPI settlement address, and terminal identity registered on Printap.
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
                color: "var(--accent-emerald)",
                fontWeight: 600,
              }}
            >
              {shop?.status ? shop.status.charAt(0).toUpperCase() + shop.status.slice(1) : "Active"} • Ready for incoming prints
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

      {/* Terminal Credentials & Web URLs */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header">
          <div className="card-title">Terminal & Customer Print URL</div>
          <span className="tech-tag">Direct P2P</span>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Shop ID (Terminal UUID)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                readOnly
                value={shopId || ""}
                className="login-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => shopId && copyToClipboard(shopId, "uuid")}
              >
                {copiedKey === "uuid" ? (
                  <>
                    <IconCheck size={14} color="var(--accent-emerald)" />
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={14} />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
          </div>

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
          Printap operates entirely peer-to-peer over encrypted WebRTC connections. Documents are never stored on any cloud server or accessible to third parties. Once spooled to your hardware printer, temporary memory buffers are destroyed immediately.
        </p>
      </div>
    </div>
  );
};
