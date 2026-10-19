import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an uncaught exception]:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            backgroundColor: "var(--bg-canvas, #F0EBED)",
            color: "var(--text-primary, #16181D)",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: 520,
              width: "100%",
              backgroundColor: "var(--bg-card, #FFFFFF)",
              border: "1px solid var(--border-subtle, #D1C8CC)",
              borderRadius: "var(--radius-lg, 2px)",
              padding: "36px 32px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "#FEE2E2",
                color: "#DC2626",
                marginBottom: 20,
                fontSize: 22,
                fontWeight: "bold",
              }}
            >
              !
            </div>

            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 10,
                letterSpacing: "-0.02em",
              }}
            >
              {this.props.fallbackTitle || "Printap Exception"}
            </h1>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary, #424750)",
                lineHeight: 1.5,
                marginBottom: 20,
              }}
            >
              An unexpected error occurred while rendering the interface. Your print jobs and hardware
              connections remain safe in background memory.
            </p>

            {this.state.error && (
              <pre
                style={{
                  textAlign: "left",
                  fontSize: 11,
                  fontFamily: "var(--font-mono, monospace)",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid var(--border-subtle, #D1C8CC)",
                  padding: 12,
                  borderRadius: "var(--radius-sm, 6px)",
                  color: "#991B1B",
                  overflowX: "auto",
                  maxHeight: 120,
                  marginBottom: 24,
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-secondary"
                style={{
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Attempt Recovery
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary"
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reload Window
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
