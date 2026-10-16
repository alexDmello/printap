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
    console.error("[Admin ErrorBoundary caught an uncaught exception]:", error, errorInfo);
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
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#F0EBED] text-[#16181D] font-sans text-center">
          <div className="max-w-md w-full bg-white border border-[#D1C8CC] rounded-sm p-8 shadow-xl">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-5 font-bold text-xl">
              !
            </div>

            <h1 className="text-lg font-bold mb-2 tracking-tight">
              {this.props.fallbackTitle || "Executive Console Exception"}
            </h1>

            <p className="text-xs text-[#424750] leading-relaxed mb-4">
              An unexpected error occurred while rendering the management console.
            </p>

            {this.state.error && (
              <pre className="text-left text-xs font-mono bg-zinc-50 border border-[#D1C8CC] p-3 rounded text-red-700 overflow-x-auto max-h-28 mb-5">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-semibold border border-[#D1C8CC] bg-white text-[#16181D] rounded hover:bg-zinc-50 cursor-pointer"
              >
                Attempt Recovery
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 text-xs font-semibold bg-[#16181D] text-white rounded hover:bg-zinc-800 cursor-pointer"
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
