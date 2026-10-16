import React from "react";

interface UpdateScreenProps {
  stage: "checking" | "available" | "downloading" | "downloaded" | "error" | "not-available";
  progress?: number;
  error?: string;
  onRestart: () => void;
  onDismiss: () => void;
}

export function UpdateScreen({ stage, progress, error, onRestart, onDismiss }: UpdateScreenProps) {
  // Silent checks should not block the app
  if (stage === "checking" || stage === "not-available") {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(22, 24, 29, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 24,
      }}
    >
      <div
        className="fade-in"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid var(--border-active, #16181D)",
          borderRadius: "var(--radius-lg, 2px)",
          padding: "36px 32px",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          boxShadow: "var(--shadow-glass-modal, 0 20px 48px rgba(22, 24, 29, 0.16))",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            backgroundColor: "var(--color-structure, #16181D)",
            color: "#FFFFFF",
            borderRadius: "var(--radius-sm, 1px)",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "var(--font-sans)",
            color: "var(--text-primary, #16181D)",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {stage === "available" && "Software Update Available"}
          {stage === "downloading" && "Downloading Package..."}
          {stage === "downloaded" && "Update Ready to Install"}
          {stage === "error" && "Update Verification"}
        </h2>

        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary, #424750)",
            lineHeight: 1.5,
            marginBottom: 24,
            fontFamily: "var(--font-sans)",
          }}
        >
          {stage === "available" && "A new version of the counter terminal is available and preparing to download."}
          {stage === "downloading" && "Downloading release assets in the background. Please keep the app open."}
          {stage === "downloaded" && "The update has been securely verified and downloaded. Restart now to apply."}
          {stage === "error" && (error || "Unable to retrieve update package.")}
        </p>

        {stage === "downloading" && (
          <div
            style={{
              width: "100%",
              height: 6,
              backgroundColor: "rgba(209, 200, 204, 0.5)",
              borderRadius: 1,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round(progress || 0)}%`,
                backgroundColor: "var(--color-structure, #16181D)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}

        {stage === "downloaded" && (
          <button
            type="button"
            onClick={onRestart}
            className="btn-primary"
            style={{ width: "100%", padding: "11px 18px", fontSize: 13 }}
          >
            Restart & Install Update
          </button>
        )}

        {stage === "error" && (
          <button
            type="button"
            onClick={onDismiss}
            className="btn-secondary"
            style={{ width: "100%", padding: "10px 18px", fontSize: 13 }}
          >
            Continue to Counter Terminal
          </button>
        )}
      </div>
    </div>
  );
}
