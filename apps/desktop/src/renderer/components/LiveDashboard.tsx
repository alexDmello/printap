import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getShopCustomerUrl } from "@printap/shared";
import {
  IconLive,
  IconPrinter,
  IconQr,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconFileText,
  IconCash,
} from "./Icons";

export interface LiveJobFile {
  fileName: string;
  fileSize?: number;
  pageCount?: number;
  settings?: any;
}

export interface LiveJob {
  sessionId: string;
  fileName?: string;
  status: "receiving" | "saving" | "printing" | "shredding" | "done" | "error";
  progressPct?: number;
  stage?: string;
  detail?: string;
  timestamp: Date;
  tokenCode?: string;
  pickupPin?: string;
  fileCount?: number;
  files?: LiveJobFile[];
  totalAmount?: number;
  paymentMethod?: string;
  paymentStatus?: "pending" | "confirmed" | "handed_over";
  paymentConfirmedAt?: Date;
}

interface LiveDashboardProps {
  currentJob: LiveJob | null;
  recentJobs: LiveJob[];
  todayPrintsCount: number;
  isListening: boolean;
  connectedPrintersCount: number;
  onConfirmPayment: (sessionId: string) => void;
  onNavigateToHistory?: () => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  currentJob,
  recentJobs,
  todayPrintsCount,
  isListening,
  connectedPrintersCount,
  onConfirmPayment,
  onNavigateToHistory,
}) => {
  const { shop } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  // Track open/close state for filenames dropdown per sessionId
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});

  const toggleJobExpanded = (sessionId: string) => {
    setExpandedJobs((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const customerUrl = getShopCustomerUrl(shop, shop?.name || "shop");

  const handleCopyLink = () => {
    if (!customerUrl) return;
    navigator.clipboard.writeText(customerUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getStatusBadge = (status: LiveJob["status"]) => {
    switch (status) {
      case "receiving":
        return { label: "Receiving Stream", className: "job-status-dot active" };
      case "saving":
        return { label: "Verifying Memory", className: "job-status-dot pending" };
      case "printing":
        return { label: "Printing to Spooler", className: "job-status-dot active" };
      case "shredding":
        return { label: "Secure Shredding", className: "job-status-dot pending" };
      case "done":
        return { label: "Completed & Shredded", className: "job-status-dot success" };
      case "error":
        return { label: "Job Failed", className: "job-status-dot error" };
      default:
        return { label: status, className: "job-status-dot" };
    }
  };

  const stages = [
    { id: "stream", num: "1", label: "Receive Stream" },
    { id: "verify", num: "2", label: "Memory Check" },
    { id: "spool", num: "3", label: "Spool to Printer" },
    { id: "shred", num: "4", label: "Secure Shred" },
  ];

  const getStageIndex = (status: LiveJob["status"]) => {
    switch (status) {
      case "receiving": return 0;
      case "saving": return 1;
      case "printing": return 2;
      case "shredding": return 3;
      case "done": return 4;
      default: return 0;
    }
  };

  const activeStageIdx = currentJob ? getStageIndex(currentJob.status) : 0;
  const currentPct = currentJob?.progressPct ?? 0;

  // Filter combined jobs list for payment side (active + recent)
  const allJobsMap = new Map<string, LiveJob>();

  // 1. Put recent jobs first
  recentJobs.forEach((j) => {
    if (j.sessionId) allJobsMap.set(j.sessionId, { ...j });
  });

  // 2. Merge currentJob if present
  if (currentJob && currentJob.sessionId) {
    const existing = allJobsMap.get(currentJob.sessionId);
    allJobsMap.set(currentJob.sessionId, {
      ...existing,
      ...currentJob,
      tokenCode: currentJob.tokenCode || existing?.tokenCode,
      totalAmount:
        currentJob.totalAmount !== undefined && currentJob.totalAmount > 0
          ? currentJob.totalAmount
          : existing?.totalAmount,
      paymentMethod: currentJob.paymentMethod || existing?.paymentMethod || "upi",
      paymentStatus:
        currentJob.paymentStatus || existing?.paymentStatus || "pending",
      files: currentJob.files || existing?.files,
      fileCount: currentJob.fileCount || existing?.fileCount,
    });
  }

  const allJobs = Array.from(allJobsMap.values());

  const pendingPayments = allJobs.filter(
    (j) =>
      // Exclude uninitialized socket connections that don't have order details yet
      (j.tokenCode || (j.totalAmount !== undefined && j.totalAmount > 0)) &&
      (!j.paymentStatus || j.paymentStatus === "pending")
  );
  // Settled / completed payments: confirmed or handed over
  const settledPayments = allJobs.filter(
    (j) => j.paymentStatus === "confirmed" || j.paymentStatus === "handed_over"
  );
  // Only the last 7 are displayed on the live monitor; the rest are in History
  const displayedSettled = settledPayments.slice(0, 7);

  return (
    <div className="content fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span>Live Monitor</span>
          <span className="status-badge active">Live & Connected</span>
        </h1>
        <p className="page-subtitle">
          Real-time print queue and counter payment verification for {shop?.name || "your counter"}.
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            <span>Today's Total Prints</span>
            <IconPrinter size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{todayPrintsCount}</div>
          <div className="stat-footnote">Direct peer-to-peer queue</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Terminal Gateway</span>
            <IconLive size={16} color="var(--text-muted)" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span className="beacon-dot" />
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: isListening ? "var(--accent-emerald)" : "var(--accent-amber)",
              }}
            >
              {isListening ? "Direct P2P Online" : "Connecting..."}
            </span>
          </div>
          <div className="stat-footnote">Zero cloud storage • Direct WebRTC</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Connected Printers</span>
            <IconPrinter size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value green">{connectedPrintersCount} Ready</div>
          <div className="stat-footnote">
            {connectedPrintersCount > 0 ? "Hardware detected & ready" : "No physical hardware detected"}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Pending Payments</span>
            <IconCash size={16} color="var(--text-muted)" />
          </div>
          <div
            className="stat-value"
            style={{
              color: pendingPayments.length > 0 ? "var(--accent-amber)" : "var(--accent-emerald)",
            }}
          >
            {pendingPayments.length}
          </div>
          <div className="stat-footnote">
            {pendingPayments.length > 0
              ? `${pendingPayments.length} awaiting cash/UPI confirmation`
              : "All counter payments verified"}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TWO-SECTION SPLIT LAYOUT:
          LEFT: Print Queue with Dropdown Filenames
          RIGHT: Payment Counter Confirmation
      ══════════════════════════════════════════════════════════ */}
      <div className="live-monitor-grid">
        {/* ─── SECTION 1: Current Queue Details (Left Side) ─── */}
        <section className="monitor-section">
          <div className="monitor-section-header">
            <h2 className="monitor-section-title">
              <IconPrinter size={18} color="var(--text-primary)" />
              <span>Current Print Queue</span>
            </h2>
            <span className="status-badge">
              {currentJob ? "1 Active Processing" : `${recentJobs.length} Logged Today`}
            </span>
          </div>

          {/* Active Job in Progress (if any) */}
          {currentJob && (
            <div className="queue-job-card active-job fade-in">
              <div className="queue-job-header">
                <div className="queue-badges">
                  {currentJob.tokenCode && (
                    <span className="token-pill">{currentJob.tokenCode}</span>
                  )}
                  <span className={getStatusBadge(currentJob.status).className} />
                  <span className="status-badge active">
                    {getStatusBadge(currentJob.status).label}
                  </span>
                </div>

                {/* Dropdown toggle button for filenames */}
                <button
                  type="button"
                  className={`queue-files-dropdown-btn ${expandedJobs[currentJob.sessionId] ? "open" : ""}`}
                  onClick={() => toggleJobExpanded(currentJob.sessionId)}
                  title="Click to view file details"
                >
                  <IconFileText size={14} />
                  <span>
                    {currentJob.files?.length || currentJob.fileCount || 1} file(s)
                  </span>
                  <span className="chevron">
                    <IconChevronDown size={14} />
                  </span>
                </button>
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, color: "#09090b" }}>
                {currentJob.fileName || "Customer Document.pdf"}
              </div>

              {/* Progress bar if receiving */}
              {typeof currentJob.progressPct === "number" && currentJob.status === "receiving" && (
                <div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${currentPct}%` }} />
                  </div>
                  <div className="progress-labels">
                    <span>Direct WebRTC Transfer Stream</span>
                    <span>{currentPct}%</span>
                  </div>
                </div>
              )}

              {/* 4-Stage Hardware Spool Pipeline */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  padding: "10px 12px",
                  background: "rgba(0, 0, 0, 0.03)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                {stages.map((st, idx) => {
                  const isPassed = activeStageIdx > idx;
                  const isCurrent = activeStageIdx === idx;
                  return (
                    <div
                      key={st.id}
                      style={{
                        fontSize: 11,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        opacity: isCurrent ? 1 : isPassed ? 0.8 : 0.4,
                        color: isCurrent ? "var(--accent-emerald)" : "var(--text-primary)",
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>
                        Step {st.num}
                      </span>
                      <span style={{ fontWeight: isCurrent ? 700 : 500 }}>{st.label}</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: isCurrent ? "var(--accent-emerald)" : "var(--text-muted)",
                        }}
                      >
                        {isCurrent ? "● Active" : isPassed ? "✓ Done" : "Wait"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Expandable Filenames List Accordion upon clicking */}
              {expandedJobs[currentJob.sessionId] && (
                <div className="queue-files-list">
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Files in this print order:
                  </div>
                  {currentJob.files && currentJob.files.length > 0 ? (
                    currentJob.files.map((file, idx) => (
                      <div key={idx} className="queue-file-row">
                        <div className="queue-file-name" title={file.fileName}>
                          <IconFileText size={14} color="var(--text-secondary)" />
                          <span>{file.fileName}</span>
                        </div>
                        <div className="queue-file-meta">
                          {file.pageCount ? `${file.pageCount} pg` : "1 pg"}
                          {file.settings?.colorMode ? ` • ${file.settings.colorMode.toUpperCase()}` : ""}
                          {file.settings?.copies ? ` • ${file.settings.copies} copy` : ""}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="queue-file-row">
                      <div className="queue-file-name">
                        <IconFileText size={14} color="var(--text-secondary)" />
                        <span>{currentJob.fileName || "Customer Document"}</span>
                      </div>
                      <div className="queue-file-meta">1 document</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {currentJob.detail || "Processing document directly in hardware memory..."}
              </div>
            </div>
          )}

          {/* Recent Spooler Job (Single Container) */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: "12px 16px" }}>
              <span className="card-title" style={{ fontSize: 13, fontWeight: 700 }}>
                <span>Recent Spooler Job</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Latest completed print
              </span>
            </div>
            <div style={{ padding: "12px 16px 16px" }}>
              {recentJobs.length > 0 ? (
                (() => {
                  const latestJob = recentJobs[0];
                  const docCount = latestJob.files?.length || latestJob.fileCount || 1;
                  const totalPages =
                    latestJob.files && latestJob.files.length > 0
                      ? latestJob.files.reduce(
                          (sum, f) => sum + (f.pageCount || 1) * (f.settings?.copies || 1),
                          0
                        )
                      : 1;

                  return (
                    <div
                      className="queue-job-card"
                      style={{
                        padding: "14px 16px",
                        background: "rgba(255, 255, 255, 0.75)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-lg)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            className="token-pill"
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              padding: "4px 10px",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {latestJob.tokenCode || "#--"}
                          </span>
                          <span className={getStatusBadge(latestJob.status).className} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-emerald)" }}>
                            Printed & Spooled
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                          {latestJob.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Small Details: Number of Documents and Number of Pages (No Price) */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          fontWeight: 500,
                          paddingTop: 6,
                          borderTop: "1px dashed var(--border-subtle)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <IconFileText size={13} color="var(--text-muted)" />
                          <span>
                            {docCount} {docCount === 1 ? "document" : "documents"}
                          </span>
                        </div>
                        <span style={{ color: "var(--text-faint)" }}>•</span>
                        <div>
                          <strong style={{ color: "#09090b" }}>{totalPages}</strong> {totalPages === 1 ? "page" : "pages"}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  No recent print jobs yet today.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── SECTION 2: Payment Counter & Confirmation (Right Side) ─── */}
        <section className="monitor-section">
          <div className="monitor-section-header">
            <h2 className="monitor-section-title">
              <IconCash size={18} color="var(--text-primary)" />
              <span>Payment Counter</span>
            </h2>
            <span
              className="status-badge"
              style={{
                background: pendingPayments.length > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.12)",
                color: pendingPayments.length > 0 ? "#b45309" : "#059669",
                borderColor: pendingPayments.length > 0 ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)",
              }}
            >
              {pendingPayments.length > 0
                ? `${pendingPayments.length} Awaiting Verification`
                : "All Settled ✓"}
            </span>
          </div>

          {/* Pending Payment Orders (Need Shop Confirmation) */}
          {pendingPayments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pendingPayments.map((job) => {
                const amount = job.totalAmount ?? 0;
                return (
                  <div key={job.sessionId} className="payment-order-card pending fade-in">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="token-pill">{job.tokenCode || "#--"}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-full)",
                          background: "rgba(245, 158, 11, 0.2)",
                          color: "#b45309",
                          textTransform: "uppercase",
                        }}
                      >
                        {job.paymentMethod ? `${job.paymentMethod.toUpperCase()} Pending` : "Payment Due"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                          COLLECT FROM CUSTOMER
                        </div>
                        <div className="payment-amount-hero">₹{amount.toFixed(2)}</div>
                      </div>

                      <div style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>
                        <div>{job.files?.length || job.fileCount || 1} document(s)</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {job.status === "printing" ? "🖨️ Printing right now..." : "✓ Paper ready on tray"}
                        </div>
                      </div>
                    </div>

                    {/* Shop Confirmation Action Button */}
                    <button
                      type="button"
                      className="confirm-payment-action-btn"
                      onClick={() => onConfirmPayment(job.sessionId)}
                      title="Click to confirm payment and notify customer for handover"
                    >
                      <IconCheck size={16} />
                      <span>Confirm Payment Received (₹{amount.toFixed(2)})</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Settled Orders: Only show the last 7, and link to History */}
          {displayedSettled.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Recent Settled Orders ({displayedSettled.length}{settledPayments.length > 7 ? ` of ${settledPayments.length}` : ""}):
                </div>
                {onNavigateToHistory && (
                  <button
                    type="button"
                    onClick={onNavigateToHistory}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    View All History →
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {displayedSettled.map((job) => (
                  <div
                    key={job.sessionId}
                    className="payment-order-card confirmed fade-in"
                    style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="token-pill">{job.tokenCode || "#--"}</span>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#09090b" }}>
                          ₹{(job.totalAmount ?? 0).toFixed(2)} received
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {job.paymentMethod ? job.paymentMethod.toUpperCase() : "UPI"} • {job.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <IconCheck size={13} />
                      <span>Verified ✓</span>
                    </span>
                  </div>
                ))}
              </div>

              {settledPayments.length > 7 && onNavigateToHistory && (
                <div style={{ marginTop: 10, textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={onNavigateToHistory}
                    style={{
                      background: "rgba(0, 0, 0, 0.04)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: "8px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>Showing last 7. View all {settledPayments.length} in History →</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Handed Over Archive / Empty State */}
          {pendingPayments.length === 0 && displayedSettled.length === 0 && (
            <div className="card" style={{ padding: "32px 20px", textAlign: "center" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "var(--accent-emerald)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <IconCheck size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#09090b" }}>
                All Payments Confirmed
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, maxWidth: 280, margin: "4px auto 0" }}>
                When a customer sends a document to print, their payment confirmation card will appear here for 1-click verification.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
