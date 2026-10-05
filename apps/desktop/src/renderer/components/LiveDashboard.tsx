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
  onRetryJob?: (sessionId: string) => void;
  onDismissJob?: (sessionId: string) => void;
  onNavigateToHistory?: () => void;
  tokenBalance?: number | null;
  tokenAlert?: { balance: number; threshold: boolean } | null;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  currentJob,
  recentJobs,
  todayPrintsCount,
  isListening,
  connectedPrintersCount,
  onConfirmPayment,
  onRetryJob,
  onDismissJob,
  onNavigateToHistory,
  tokenBalance,
  tokenAlert,
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
    const isConfirmed =
      currentJob.paymentStatus === "confirmed" ||
      existing?.paymentStatus === "confirmed";

    allJobsMap.set(currentJob.sessionId, {
      ...existing,
      ...currentJob,
      tokenCode: currentJob.tokenCode || existing?.tokenCode,
      totalAmount:
        currentJob.totalAmount !== undefined && currentJob.totalAmount > 0
          ? currentJob.totalAmount
          : existing?.totalAmount,
      paymentMethod: currentJob.paymentMethod || existing?.paymentMethod || "upi",
      paymentStatus: isConfirmed
        ? "confirmed"
        : currentJob.paymentStatus || existing?.paymentStatus || "pending",
      paymentConfirmedAt:
        currentJob.paymentConfirmedAt || existing?.paymentConfirmedAt,
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
  // Only the last 10 are displayed on the live monitor; the rest are in History
  const displayedSettled = settledPayments.slice(0, 10);

  // Combine active job + recent jobs for print queue table
  const printQueueJobs = React.useMemo(() => {
    const list: LiveJob[] = [];
    if (currentJob) {
      list.push(currentJob);
    }
    recentJobs.forEach((rj) => {
      if (!currentJob || rj.sessionId !== currentJob.sessionId) {
        list.push(rj);
      }
    });
    return list;
  }, [currentJob, recentJobs]);

  return (
    <div className="content fade-in">
      {tokenBalance === 0 && (
        <div className="card" style={{ marginBottom: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>⛔</div>
            <div>
              <h3 style={{ margin: 0, color: 'rgb(239, 68, 68)', fontSize: 16, fontWeight: 700 }}>Tokens Exhausted</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                Your print shop is out of tokens. All incoming print jobs will be rejected. Please top up your tokens.
              </p>
            </div>
          </div>
        </div>
      )}

      {tokenBalance !== 0 && tokenAlert && (
        <div className="card" style={{ marginBottom: 20, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>{tokenAlert.balance <= 5 ? '🔴' : '🟡'}</div>
            <div>
              <h3 style={{ margin: 0, color: 'rgb(245, 158, 11)', fontSize: 16, fontWeight: 700 }}>Low Token Balance</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                You have {tokenAlert.balance} tokens remaining. Top up soon to avoid interruption.
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Top Stat Cards (Terminal Gateway removed -> 3 balanced cards) */}
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
              ? `${pendingPayments.length} awaiting verification`
              : "All counter payments verified"}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          THREE-PANEL TABLE SYSTEM:
          1. Current Print Queue (Table)
          2. Payment Counter (Pending Verification - Table)
          3. Done Payments (Settled/Verified Orders - Table)
      ══════════════════════════════════════════════════════════ */}
      <div className="live-monitor-tables-grid">
        {/* ─── TABLE 1: Current Print Queue ─── */}
        <div className="monitor-table-card">
          <div className="monitor-table-header">
            <div className="monitor-table-title">
              <IconPrinter size={16} color="var(--text-primary)" />
              <span>Current Print Queue</span>
            </div>
            <span className="status-badge active">
              {currentJob ? "1 Processing" : `${printQueueJobs.length} Today`}
            </span>
          </div>

          <div className="monitor-table-container">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th style={{ width: 68 }}>Token</th>
                  <th>Document & Specs</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 60, textAlign: "right" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {printQueueJobs.length > 0 ? (
                  printQueueJobs.map((job) => {
                    const isActive = currentJob?.sessionId === job.sessionId;
                    const docCount = job.files?.length || job.fileCount || 1;
                    const totalPages =
                      job.files && job.files.length > 0
                        ? job.files.reduce(
                            (sum, f) => sum + (f.pageCount || 1) * (f.settings?.copies || 1),
                            0
                          )
                        : 1;
                    const isExpanded = !!expandedJobs[job.sessionId];
                    const hasMultiFiles = job.files && job.files.length > 1;

                    return (
                      <React.Fragment key={job.sessionId}>
                        <tr className={isActive ? "table-row-active" : ""}>
                          <td>
                            <span className="token-pill">{job.tokenCode || "#--"}</span>
                          </td>
                          <td>
                            <div className="table-doc-cell">
                              <span className="table-file-title" title={job.fileName || "Customer Document.pdf"}>
                                {job.fileName || "Customer Document.pdf"}
                              </span>
                              <div className="table-file-subtext">
                                <span>
                                  {docCount} {docCount === 1 ? "doc" : "docs"} • {totalPages} {totalPages === 1 ? "pg" : "pgs"}
                                </span>
                                {hasMultiFiles && (
                                  <button
                                    type="button"
                                    className={`table-expand-btn ${isExpanded ? "open" : ""}`}
                                    onClick={() => toggleJobExpanded(job.sessionId)}
                                    title="View files"
                                  >
                                    <span>{isExpanded ? "Hide" : "Files"}</span>
                                    <IconChevronDown size={11} />
                                  </button>
                                )}
                              </div>
                              {isActive && job.status === "receiving" && typeof job.progressPct === "number" && (
                                <div className="table-progress-track">
                                  <div
                                    className="table-progress-fill"
                                    style={{ width: `${Math.min(100, Math.max(0, job.progressPct))}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            {job.status === "receiving" ? (
                              <span className="status-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                                Stream ({job.progressPct || 0}%)
                              </span>
                            ) : job.status === "printing" ? (
                              <span className="status-badge active" style={{ background: "#fef3c7", color: "#b45309" }}>
                                ● Printing
                              </span>
                            ) : job.status === "error" ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                <span className="status-badge" style={{ background: "#fee2e2", color: "#dc2626" }}>
                                  Failed
                                </span>
                                <div style={{ display: "flex", gap: 3 }}>
                                  <button
                                    type="button"
                                    className="btn-retry-tiny"
                                    onClick={() => onRetryJob?.(job.sessionId)}
                                  >
                                    Retry
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-dismiss-tiny"
                                    onClick={() => onDismissJob?.(job.sessionId)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="status-badge" style={{ background: "#ecfdf5", color: "#047857" }}>
                                ✓ Spooled
                              </span>
                            )}
                          </td>
                          <td className="table-time-cell" style={{ textAlign: "right" }}>
                            {job.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>

                        {/* Collapsible files row if expanded */}
                        {isExpanded && job.files && job.files.length > 0 && (
                          <tr className="table-expanded-row">
                            <td colSpan={4}>
                              <div className="table-expanded-files-list">
                                {job.files.map((file, fIdx) => (
                                  <div key={fIdx} className="table-expanded-file-row">
                                    <IconFileText size={12} color="var(--text-muted)" />
                                    <span className="file-name" title={file.fileName}>
                                      {file.fileName}
                                    </span>
                                    <span className="file-meta">
                                      {file.pageCount || 1} pg • {(file.settings?.colorMode || "bw").toUpperCase()} •{" "}
                                      {file.settings?.copies || 1} cp
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="monitor-table-empty">
                      <div className="empty-state-content">
                        <IconPrinter size={26} color="var(--text-muted)" />
                        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginTop: 6 }}>
                          Queue is idle
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0" }}>
                          New orders will appear here automatically.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── TABLE 2: Payment Counter (Pending Verification) ─── */}
        <div className="monitor-table-card">
          <div className="monitor-table-header">
            <div className="monitor-table-title">
              <IconCash size={16} color="var(--text-primary)" />
              <span>Payment Counter</span>
            </div>
            <span
              className="status-badge"
              style={{
                background: pendingPayments.length > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.12)",
                color: pendingPayments.length > 0 ? "#b45309" : "#059669",
                borderColor: pendingPayments.length > 0 ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)",
              }}
            >
              {pendingPayments.length > 0 ? `${pendingPayments.length} Due` : "All Settled ✓"}
            </span>
          </div>

          <div className="monitor-table-container">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th style={{ width: 68 }}>Token</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th style={{ width: 85, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.length > 0 ? (
                  pendingPayments.map((job) => {
                    const amount = job.totalAmount ?? 0;
                    const docCount = job.files?.length || job.fileCount || 1;

                    return (
                      <tr key={job.sessionId}>
                        <td>
                          <span className="token-pill">{job.tokenCode || "#--"}</span>
                        </td>
                        <td>
                          <span className="table-amount-due">₹{amount.toFixed(2)}</span>
                        </td>
                        <td>
                          <div className="table-method-cell">
                            <span className="method-pill">{job.paymentMethod?.toUpperCase() || "CASH"}</span>
                            <span className="subtext">{docCount} {docCount === 1 ? "doc" : "docs"}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="table-confirm-btn"
                            onClick={() => onConfirmPayment(job.sessionId)}
                            title={`Confirm payment of ₹${amount.toFixed(2)}`}
                          >
                            <IconCheck size={13} />
                            <span>Confirm</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="monitor-table-empty">
                      <div className="empty-state-content">
                        <IconCheck size={26} color="var(--accent-emerald)" />
                        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginTop: 6 }}>
                          All Settled
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0" }}>
                          Pending payments will appear here for 1-click verification.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── TABLE 3: Done Payments (Towards Right of Payment Counter) ─── */}
        <div className="monitor-table-card">
          <div className="monitor-table-header">
            <div className="monitor-table-title">
              <IconCheck size={16} color="var(--accent-emerald)" />
              <span>Done Payments</span>
            </div>
            <span className="status-badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669" }}>
              {settledPayments.length} Settled
            </span>
          </div>

          <div className="monitor-table-container">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th style={{ width: 68 }}>Token</th>
                  <th>Received</th>
                  <th>Method & Time</th>
                  <th style={{ width: 85, textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedSettled.length > 0 ? (
                  displayedSettled.map((job) => {
                    const amount = job.totalAmount ?? 0;

                    return (
                      <tr key={job.sessionId}>
                        <td>
                          <span className="token-pill">{job.tokenCode || "#--"}</span>
                        </td>
                        <td>
                          <span className="table-amount-settled">₹{amount.toFixed(2)}</span>
                        </td>
                        <td>
                          <div className="table-method-cell">
                            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                              {job.paymentMethod ? job.paymentMethod.toUpperCase() : "UPI"}
                            </span>
                            <span className="subtext">
                              {job.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="table-verified-badge">
                            <IconCheck size={12} />
                            <span>Verified</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="monitor-table-empty">
                      <div className="empty-state-content">
                        <IconCash size={26} color="var(--text-muted)" />
                        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginTop: 6 }}>
                          No settled orders yet
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0" }}>
                          Completed orders will be logged here.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {settledPayments.length > 7 && onNavigateToHistory && (
            <div className="monitor-table-footer">
              <button type="button" onClick={onNavigateToHistory} className="table-history-link">
                <span>View all {settledPayments.length} in History →</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
