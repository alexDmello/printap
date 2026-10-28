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
  IconRefresh,
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
  status: "receiving" | "saving" | "printing" | "shredding" | "done" | "error" | "cancelled" | "queued" | "pending_payment";
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

import type { QueuedPrintJob } from "../lib/fifo-dispatcher";

interface LiveDashboardProps {
  currentJob: LiveJob | null;
  recentJobs: LiveJob[];
  pendingQueue: QueuedPrintJob[];
  todayPrintsCount: number;
  isListening: boolean;
  connectedPrintersCount: number;
  onConfirmPayment: (sessionId: string) => void;
  onCancelOrder: (sessionId: string) => void;
  onRetryJob?: (sessionId: string) => void;
  onDismissJob?: (sessionId: string) => void;
  onNavigateToHistory?: () => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = React.memo(({
  currentJob,
  recentJobs,
  pendingQueue,
  todayPrintsCount,
  isListening,
  connectedPrintersCount,
  onConfirmPayment,
  onCancelOrder,
  onRetryJob,
  onDismissJob,
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
      case "cancelled":
        return { label: "Cancelled", className: "job-status-dot error" };
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
      case "cancelled": return -1;
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
  const settledPayments = allJobs.filter(
    (j) =>
      j.status === "done" &&
      (j.paymentStatus === "confirmed" || j.paymentStatus === "handed_over" || !j.paymentStatus || (j.paymentStatus as any) === "done")
  );
  // Only the last 10 are displayed on the live monitor; the rest are in History
  const displayedSettled = settledPayments.slice(0, 10);

  // Combine pendingQueue, currentJob, and recentJobs by sessionId into a single deduplicated list
  const combinedQueueJobs = React.useMemo(() => {
    const jobMap = new Map<string, any>();

    // 1. Add recentJobs first (historical/completed/cancelled)
    recentJobs.forEach((j) => {
      if (j.sessionId) {
        jobMap.set(j.sessionId, { ...j });
      }
    });

    // 2. Overlay pendingQueue (authoritative for unprinted orders waiting for payment/print)
    pendingQueue.forEach((pq) => {
      if (pq.sessionId) {
        const existing = jobMap.get(pq.sessionId);
        jobMap.set(pq.sessionId, {
          ...existing,
          ...pq,
          status: existing?.status === "printing" ? "printing" : "pending_payment",
          paymentStatus: pq.paymentStatus || existing?.paymentStatus || "pending",
          fileName: pq.files?.[0]?.fileName || existing?.fileName || `Order ${pq.tokenCode}`,
          fileCount: pq.files?.length || existing?.fileCount || 1,
        });
      }
    });

    // 3. Overlay currentJob (active streaming or printing)
    if (currentJob && currentJob.sessionId) {
      const existing = jobMap.get(currentJob.sessionId);
      const isAlreadyInPendingQueue = pendingQueue.some((pq) => pq.sessionId === currentJob.sessionId);
      jobMap.set(currentJob.sessionId, {
        ...existing,
        ...currentJob,
        status: isAlreadyInPendingQueue ? "pending_payment" : currentJob.status,
      });
    }

    return Array.from(jobMap.values());
  }, [currentJob, recentJobs, pendingQueue]);

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
            <span>Pending Orders</span>
            <IconCash size={16} color="var(--text-muted)" />
          </div>
          <div
            className="stat-value"
            style={{
              color: pendingQueue.length > 0 ? "var(--accent-amber)" : "var(--accent-emerald)",
            }}
          >
            {pendingQueue.length}
          </div>
          <div className="stat-footnote">
            {pendingQueue.length > 0
              ? `${pendingQueue.length} awaiting action`
              : "All clear"}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TWO-PANEL TABLE SYSTEM:
          1. Live Orders (Unified Print Queue & Action Required)
          2. Settled Orders (Done Payments - Table)
      ══════════════════════════════════════════════════════════ */}
      <div className="live-monitor-tables-grid">
        {/* ─── TABLE 1: Live Orders (Unified Print Queue & Action Required) ─── */}
        <div className="monitor-table-card">
          <div className="monitor-table-header">
            <div className="monitor-table-title">
              <IconPrinter size={16} color="var(--text-primary)" />
              <span>Live Orders</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {pendingQueue.length > 0 && (
                <span className="status-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#b45309" }}>
                  {pendingQueue.length} Action Required
                </span>
              )}
              <span className="status-badge active">
                {currentJob ? "1 Processing" : `${combinedQueueJobs.length} Today`}
              </span>
            </div>
          </div>

          <div className="monitor-table-container">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th style={{ width: 68 }}>Token</th>
                  <th>Document & Specs</th>
                  <th>Amount</th>
                  <th style={{ width: 150, textAlign: "right" }}>Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {combinedQueueJobs.length > 0 ? (
                  combinedQueueJobs.map((rawJob) => {
                    const job = rawJob as any;
                    const isActive = currentJob?.sessionId === job.sessionId;
                    const isReceiving = job.status === "receiving";
                    const isFailedOrCancelled = job.status === "error" || job.status === "cancelled";
                    const isPendingPayment = (!job.paymentStatus || job.paymentStatus === "pending") && !isReceiving && !isFailedOrCancelled;
                    const docCount = job.files?.length || job.fileCount || 1;
                    const amount = job.totalAmount ?? 0;
                    const totalPages =
                      job.files && job.files.length > 0
                        ? job.files.reduce(
                            (sum: number, f: LiveJobFile) => sum + (f.pageCount || 1) * (f.settings?.copies || 1),
                            0
                          )
                        : 1;
                    const isExpanded = !!expandedJobs[job.sessionId];
                    const hasMultiFiles = job.files && job.files.length > 1;

                    return (
                      <React.Fragment key={job.sessionId}>
                        <tr className={isActive || isPendingPayment ? "table-row-active" : ""}>
                          <td>
                            <span className="token-pill">{job.tokenCode || "#--"}</span>
                          </td>
                          <td>
                            <div className="table-doc-cell">
                              <span className="table-file-title" title={job.fileName || "Customer Document"}>
                                {job.fileName || "Customer Document"}
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
                              {isActive && isReceiving && typeof job.progressPct === "number" && (
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
                            <div className="table-amount-due" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              ₹{amount.toFixed(2)}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontWeight: 500 }}>
                              {job.paymentMethod?.toUpperCase() || "UPI"}
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {isPendingPayment ? (
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                                <button
                                  type="button"
                                  className="table-confirm-btn hover-pop"
                                  style={{ padding: "6px 12px", background: "var(--accent-emerald)", color: "white", borderRadius: "6px", fontWeight: 700, fontSize: "11px", border: "none", cursor: "pointer", boxShadow: "0 2px 4px rgba(16, 185, 129, 0.2)" }}
                                  onClick={() => onConfirmPayment(job.sessionId)}
                                  title={`Confirm Payment & Print (₹${amount.toFixed(2)})`}
                                >
                                  Print
                                </button>
                                <button
                                  type="button"
                                  className="table-cancel-btn hover-pop"
                                  onClick={() => onCancelOrder(job.sessionId)}
                                  title="Cancel Order & Refund"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : isReceiving ? (
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                                <span className="status-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                                  Stream ({job.progressPct || 0}%)
                                </span>
                                <button
                                  type="button"
                                  className="table-cancel-btn hover-pop"
                                  onClick={() => onCancelOrder(job.sessionId)}
                                  title="Cancel Order"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : job.status === "printing" ? (
                              <span className="status-badge active" style={{ background: "#fef3c7", color: "#b45309" }}>
                                ● Printing
                              </span>
                            ) : isFailedOrCancelled ? (
                              <div className="table-failed-action-group">
                                <span className={`table-status-pill ${job.status === "cancelled" ? "cancelled" : "failed"}`}>
                                  {job.status === "cancelled" ? "Cancelled" : "Failed"}
                                </span>
                                {job.status === "error" && (
                                  <button
                                    type="button"
                                    className="table-action-retry-btn"
                                    onClick={() => onRetryJob?.(job.sessionId)}
                                    title="Retry printing on hardware spooler"
                                  >
                                    <IconRefresh size={12} />
                                    <span>Retry</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="table-action-dismiss-btn"
                                  onClick={() => onDismissJob?.(job.sessionId)}
                                  title="Close and notify customer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <span className="status-badge" style={{ background: "#ecfdf5", color: "#047857" }}>
                                ✓ Spooled
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Collapsible files row if expanded */}
                        {isExpanded && job.files && job.files.length > 0 && (
                          <tr className="table-expanded-row">
                            <td colSpan={4}>
                              <div className="table-expanded-files-list">
                                {job.files.map((file: LiveJobFile, fIdx: number) => (
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
                          {job.status === "cancelled" ? (
                             <span className="status-badge" style={{ background: "#fee2e2", color: "#dc2626" }}>Cancelled</span>
                          ) : (
                            <span className="table-verified-badge">
                              <IconCheck size={12} />
                              <span>Done</span>
                            </span>
                          )}
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
});
