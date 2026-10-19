import React from "react";

export type UpdateStage = "available" | "downloading" | "downloaded" | "error" | null;

interface UpdateScreenProps {
  stage: UpdateStage;
  progress?: number;
  error?: string;
  onStartDownload: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

export const UpdateScreen: React.FC<UpdateScreenProps> = ({
  stage,
  progress = 0,
  error,
  onStartDownload,
  onRestart,
  onDismiss,
}) => {
  if (!stage) return null;

  return (
    <div className="modal-overlay">
      <div
        className="confirm-dialog-card"
        style={{
          maxWidth: stage === "error" ? 640 : 420,
          width: stage === "error" ? "min(640px, 92vw)" : "min(420px, 92vw)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* State 1: Update Available */}
        {stage === "available" && (
          <>
            <div className="confirm-dialog-title">Software Update Available</div>
            <div className="confirm-dialog-body" style={{ marginBottom: 20 }}>
              A new version of Printap is available. Would you like to download and install it now to get the latest features and security improvements?
            </div>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn-dialog-cancel" onClick={onDismiss}>
                Remind Me Later
              </button>
              <button type="button" className="btn-dialog-confirm" onClick={onStartDownload}>
                Download Update
              </button>
            </div>
          </>
        )}

        {/* State 2: Downloading */}
        {stage === "downloading" && (
          <>
            <div className="confirm-dialog-title">Downloading Update...</div>
            <div className="confirm-dialog-body" style={{ marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                Please wait while the update downloads in the background.
              </div>
              
              <div style={{ width: "100%", height: 8, background: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div 
                  style={{ 
                    height: "100%", 
                    width: `${Math.min(100, Math.max(0, progress))}%`, 
                    background: "var(--accent-emerald)",
                    transition: "width 0.2s ease-out"
                  }} 
                />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>
                {Math.round(progress)}%
              </div>
            </div>
          </>
        )}

        {/* State 3: Downloaded & Ready */}
        {stage === "downloaded" && (
          <>
            <div className="confirm-dialog-title" style={{ color: "var(--accent-emerald)" }}>Update Ready to Install</div>
            <div className="confirm-dialog-body" style={{ marginBottom: 20 }}>
              The update has been successfully downloaded. The terminal needs to restart to apply the changes. 
              <br/><br/>
              <strong>Note:</strong> Ensure no active print jobs are running before restarting.
            </div>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn-dialog-cancel" onClick={onDismiss}>
                Install Later
              </button>
              <button type="button" className="btn-dialog-confirm" style={{ background: "var(--accent-emerald)", borderColor: "var(--accent-emerald)" }} onClick={onRestart}>
                Restart & Install
              </button>
            </div>
          </>
        )}

        {/* State 4: Error */}
        {stage === "error" && (
          <>
            <div className="confirm-dialog-title" style={{ color: "var(--accent-rose)", flexShrink: 0 }}>
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
              <div style={{ marginBottom: 8, flexShrink: 0 }}>
                There was an error while trying to download the update:
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 6,
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: "var(--accent-rose)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                  overflowY: "auto",
                  maxHeight: "220px",
                }}
              >
                {error || "Unknown network error"}
              </div>
            </div>
            <div className="confirm-dialog-actions" style={{ flexShrink: 0, marginTop: "auto" }}>
              <button type="button" className="btn-dialog-cancel" onClick={onDismiss}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
