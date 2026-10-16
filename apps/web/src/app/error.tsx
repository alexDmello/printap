"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary Caught]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 select-none">
      <div className="glass rounded-3xl p-8 sm:p-10 max-w-md w-full text-center relative overflow-hidden border border-black/8 shadow-2xl">
        <div className="inline-flex items-center gap-2 mb-6">
          <img
            src="/logo.png"
            alt="Printap"
            className="w-7 h-7 rounded-lg object-cover shadow-sm border border-black/10"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-sm font-bold tracking-tight text-gray-900">
            Printap
          </span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          An unexpected error occurred while loading this page.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-all"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
