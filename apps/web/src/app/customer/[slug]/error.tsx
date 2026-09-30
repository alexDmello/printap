"use client";

import React, { useEffect } from "react";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Customer Error Boundary Caught]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 select-none">
      <div className="glass rounded-3xl p-8 sm:p-10 max-w-md w-full text-center relative overflow-hidden border border-black/8 shadow-2xl">
        <div className="inline-flex items-center gap-2 mb-6">
          <img
            src="/logo.png"
            alt="Printap"
            className="w-7 h-7 rounded-lg object-cover shadow-sm border border-black/10"
          />
          <span className="text-sm font-bold tracking-tight text-gray-900">
            Printap
          </span>
        </div>

        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Unable to Load Shop Terminal
        </h1>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          We encountered a connection issue while reaching the counter. Please click try again to reconnect.
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
