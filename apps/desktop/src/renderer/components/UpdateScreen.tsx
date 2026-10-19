import React from "react";

export type UpdateStage = "checking" | "available" | "downloading" | "downloaded" | "error" | "not-available" | null;

interface UpdateScreenProps {
  stage: UpdateStage;
  progress?: number;
  error?: string;
  version?: string;
  onStartDownload: () => void;
  onRestart: () => void;
  onDismiss?: () => void;
  isCompulsory?: boolean;
}

export const UpdateScreen: React.FC<UpdateScreenProps> = ({
  stage,
  progress = 0,
  error,
  version,
  onStartDownload,
  onRestart,
  onDismiss,
  isCompulsory = true,
}) => {
  if (!stage || stage === "not-available" || stage === "checking") return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div
        className="confirm-dialog-card"
        style={{
          maxWidth: stage === "error" ? 640 : 440,
          width: stage === "error" ? "min(640px, 92vw)" : "min(440px, 92vw)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* State 1: Update Available (Compulsory) */}
        {stage === "available" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#FEF3C7",
                  border: "1px solid #FDE68A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#D97706",
                  fontSize: 20,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                !
              </div>
              <div>
                <div className="confirm-dialog-title" style={{ margin: 0, fontSize: 16 }}>
                  Mandatory Update Required
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  {version ? `New Version: v${version}` : "New release available"}
                </div>
              </div>
            </div>

            <div className="confirm-dialog-body" style={{ marginBottom: 22, fontSize: 13, lineHeight: 1.55 }}>
              A required update is available for the Printap Terminal. To maintain secure counter printing, database synchronization, and encryption standards, this update must be installed to continue.
            </div>

            <div className="confirm-dialog-actions" style={{ flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                className="btn-dialog-confirm"
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: "var(--radius-sm, 8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onClick={onStartDownload}
              >
                <span>Download & Install Update</span>
              </button>
            </div>
          </>
        )}

        {/* State 2: Downloading */}
        {stage === "downloading" && (
          <>
            <div className="confirm-dialog-title" style={{ fontSize: 16, marginBottom: 8 }}>
              Downloading Update Package...
            </div>
            <div className="confirm-dialog-body" style={{ marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                Please keep the application open. Downloading verified files from the release server.
              </div>
              
              <div
                style={{
                  width: "100%",
                  height: 8,
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: 9999,
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <div 
                  style={{ 
                    height: "100%", 
                    width: `${Math.min(100, Math.max(0, progress))}%`, 
                    background: "var(--accent-emerald, #10b981)",
                    borderRadius: 9999,
                    transition: "width 0.2s ease-out",
                  }} 
                />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                {Math.round(progress)}%
              </div>
            </div>
          </>
        )}

        {/* State 3: Downloaded & Ready to Restart (Compulsory) */}
        {stage === "downloaded" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#D1FAE5",
                  border: "1px solid #A7F3D0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#059669",
                  fontSize: 20,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <div>
                <div className="confirm-dialog-title" style={{ margin: 0, fontSize: 16, color: "var(--accent-emerald, #10b981)" }}>
                  Update Ready to Apply
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  Package verified
                </div>
              </div>
            </div>

            <div className="confirm-dialog-body" style={{ marginBottom: 22, fontSize: 13, lineHeight: 1.55 }}>
              The update has been downloaded. The terminal application will restart now to apply the updates and complete installation.
            </div>

            <div className="confirm-dialog-actions" style={{ flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                className="btn-dialog-confirm"
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  background: "var(--accent-emerald, #10b981)",
                  borderColor: "var(--accent-emerald, #10b981)",
                  borderRadius: "var(--radius-sm, 8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onClick={onRestart}
              >
                <span>Restart & Apply Update Now</span>
              </button>
            </div>
          </>
        )}

        {/* State 4: Error */}
        {stage === "error" && (
          <>
            <div className="confirm-dialog-title" style={{ color: "var(--accent-rose)", flexShrink: 0, fontSize: 16 }}>
              Update Failed
            </div>
            <div
              className="confirm-dialog-body"
              style={{
                marginBottom: 18,
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ marginBottom: 8, flexShrink: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                An error occurred while downloading the update:
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "var(--radius-sm, 8px)",
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: "var(--accent-rose)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                  overflowY: "auto",
                  maxHeight: "180px",
                }}
              >
                {error || "Unknown network error"}
              </div>
            </div>
            <div className="confirm-dialog-actions" style={{ flexShrink: 0, marginTop: "auto", display: "flex", gap: 10 }}>
              {!isCompulsory && onDismiss && (
                <button
                  type="button"
                  className="btn-dialog-cancel"
                  onClick={onDismiss}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm, 8px)" }}
                >
                  Skip for This Session
                </button>
              )}
              <button
                type="button"
                className="btn-dialog-confirm"
                onClick={onStartDownload}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--radius-sm, 8px)" }}
              >
                Retry Download
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
