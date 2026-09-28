import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { IconLive, IconPrinter, IconQr, IconCopy, IconCheck } from "./Icons";

export interface LiveJob {
  sessionId: string;
  fileName?: string;
  status: "receiving" | "saving" | "printing" | "shredding" | "done" | "error";
  progressPct?: number;
  stage?: string;
  detail?: string;
  timestamp: Date;
}

interface LiveDashboardProps {
  currentJob: LiveJob | null;
  recentJobs: LiveJob[];
  todayPrintsCount: number;
  isListening: boolean;
  connectedPrintersCount: number;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  currentJob,
  recentJobs,
  todayPrintsCount,
  isListening,
  connectedPrintersCount,
}) => {
  const { shop, shopId } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);

  const customerUrl = shopId ? `http://localhost:3001/print/${shopId}` : "";

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

  return (
    <div className="content fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span>Live Print Monitor</span>
          <span className="status-badge active">Live & Connected</span>
        </h1>
        <p className="page-subtitle">
          Real-time peer-to-peer queue and hardware spool status for {shop?.name || "your counter"}.
        </p>
      </div>

      {/* Top Stat Cards — strictly operational metrics, no money metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            <span>Today's Total Prints</span>
            <IconPrinter size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value">
            {todayPrintsCount}
          </div>
          <div className="stat-footnote">
            Direct peer-to-peer document queue
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Terminal Gateway</span>
            <IconLive size={16} color="var(--text-muted)" />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
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
          <div className="stat-footnote">
            Zero cloud storage • Direct WebRTC link
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Connected Printers</span>
            <IconPrinter size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value green">
            {connectedPrintersCount} Ready
          </div>
          <div className="stat-footnote">
            {connectedPrintersCount > 0
              ? "Physical machines online & idle"
              : "No physical hardware detected"}
          </div>
        </div>
      </div>

      {/* Active Session Section */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: 12,
          }}
        >
          Active Print Session
        </h2>

        {currentJob ? (
          <div className="active-session-card fade-in">
            <div className="active-session-meta">
              <span className={getStatusBadge(currentJob.status).className} />
              <span className="status-badge active">
                {getStatusBadge(currentJob.status).label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "Geist Mono, monospace",
                  color: "var(--text-muted)",
                }}
              >
                #{currentJob.sessionId.slice(0, 8)}
              </span>
            </div>

            <div className="active-session-title">
              {currentJob.fileName || "Customer Document.pdf"}
            </div>

            {/* Smooth Fluid Progress Track */}
            {typeof currentJob.progressPct === "number" && currentJob.status === "receiving" && (
              <div style={{ margin: "14px 0 8px" }}>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${currentPct}%` }}
                  />
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
                gap: 10,
                marginTop: 18,
                padding: "12px 14px",
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
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      opacity: isCurrent ? 1 : isPassed ? 0.8 : 0.4,
                      color: isCurrent ? "var(--accent-emerald)" : "var(--text-primary)",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                      Step {st.num}
                    </span>
                    <span style={{ fontWeight: isCurrent ? 700 : 500 }}>
                      {st.label}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isCurrent ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                      {isCurrent ? "● Processing" : isPassed ? "✓ Completed" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginTop: 12,
              }}
            >
              {currentJob.detail ||
                (currentJob.status === "shredding"
                  ? "Securely erasing temporary memory buffers..."
                  : currentJob.status === "printing"
                  ? "Spooling document to Windows hardware printer driver..."
                  : "Streaming encrypted file chunks directly to local memory...")}
            </div>
          </div>
        ) : (
          /* Frosted Glass Idle Terminal Banner */
          <div className="idle-banner fade-in">
            <div className="idle-radar">
              <IconLive size={24} />
            </div>

            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              Counter Terminal Ready & Listening
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginTop: 6,
                maxWidth: 440,
                margin: "6px auto 18px",
                lineHeight: 1.5,
              }}
            >
              Waiting for customers to scan your counter QR code. Documents stream directly from mobile browsers to this PC over local Wi-Fi.
            </p>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255, 255, 255, 0.8)",
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <IconQr size={15} color="var(--text-secondary)" />
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "Geist Mono, monospace",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {customerUrl || "Terminal offline"}
              </span>
              <button
                type="button"
                className="btn-ghost"
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  borderRadius: "var(--radius-full)",
                  marginLeft: 4,
                }}
                onClick={handleCopyLink}
              >
                {copiedLink ? (
                  <>
                    <IconCheck size={12} color="var(--accent-emerald)" />
                    <span style={{ color: "var(--accent-emerald)" }}>Copied</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={12} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Jobs Ledger */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>Recent Print Activity</span>
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            {recentJobs.length} logged today
          </span>
        </div>
        <div className="card-body" style={{ padding: "0 22px" }}>
          {recentJobs.length > 0 ? (
            <ul className="job-list">
              {recentJobs.map((job) => (
                <li
                  key={job.sessionId + job.timestamp.getTime()}
                  className="job-item"
                >
                  <span className={getStatusBadge(job.status).className} />
                  <div className="job-name">
                    <span>
                      {job.fileName || `Document #${job.sessionId.slice(0, 8)}`}
                    </span>
                    {job.detail && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginLeft: 8,
                          fontWeight: 400,
                        }}
                      >
                        — {job.detail}
                      </span>
                    )}
                  </div>
                  <span className="job-time">
                    {job.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div
              style={{
                padding: "36px 0",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              No print jobs logged yet today. When a customer scans your counter QR code, print sessions will appear here instantly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
