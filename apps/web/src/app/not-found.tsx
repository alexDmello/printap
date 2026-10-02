import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center select-none bg-mesh">
      <div className="glass rounded-3xl p-8 sm:p-10 max-w-md w-full border border-white/10 shadow-2xl space-y-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <img
            src="/logo.png"
            alt="Printap"
            className="w-7 h-7 rounded-lg object-cover shadow-sm border border-white/10"
          />
          <span className="text-sm font-bold tracking-tight text-white">
            Printap
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-4xl font-extrabold text-white font-mono">404</p>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The page you are looking for does not exist or has been removed.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
