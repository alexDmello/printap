import React from "react";
import Link from "next/link";
import { ROOT_DOMAIN } from "@printap/shared";

export default function DesktopRequiredPage({
  searchParams,
}: {
  searchParams?: { target?: string };
}) {
  const isShop = searchParams?.target === "shop";
  const isPlatform = searchParams?.target === "platform";

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between p-6 sm:p-10 font-sans selection:bg-black selection:text-white">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black border border-zinc-800 p-1 flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Printap Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-black">Printap</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                SECURITY PERIMETER
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-400">Zero-Cloud Print Infrastructure</p>
          </div>
        </div>

        <Link
          href="/"
          className="text-xs font-mono text-zinc-500 hover:text-black border border-zinc-200 hover:border-black rounded-xl px-3.5 py-1.5 transition"
        >
          ← Back to Mellod
        </Link>
      </header>

      {/* Main Hero Container */}
      <main className="max-w-3xl mx-auto w-full my-auto py-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-300 text-xs font-mono text-zinc-800 mb-6 animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
          <span>BROWSER ACCESS RESTRICTED • DESKTOP ONLY</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black mb-4">
          {isShop
            ? "Shop Console is Desktop-Only"
            : isPlatform
            ? "Platform Admin is Desktop-Only"
            : "Management Console is Desktop-Only"}
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 max-w-xl mx-auto leading-relaxed mb-8">
          Web browser administration has been retired. All shop operations, printer spooler queues,
          convenience fee setups, and platform governance are now strictly managed through the
          dedicated <strong>Printap Electron Desktop Applications</strong>.
        </p>

        {/* Security & Architecture Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-10">
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="text-xs font-bold text-black mb-1 flex items-center gap-1.5">
              <span>🖨️</span> Hardware Integration
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Desktop agents interface directly with local printer drivers with zero browser sandbox delays.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="text-xs font-bold text-black mb-1 flex items-center gap-1.5">
              <span>🔥</span> DoD File Shredding
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Customer PDFs stream directly to RAM, print immediately, and are wiped. No cloud storage.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="text-xs font-bold text-black mb-1 flex items-center gap-1.5">
              <span>💾</span> Local Accounting
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Monthly revenue, orders, and event archives are exported locally to your machine.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-5 rounded-2xl bg-zinc-900 text-white text-left max-w-xl mx-auto mb-8 space-y-2">
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            Operator Access Instructions
          </div>
          <div className="text-xs text-zinc-300 leading-relaxed space-y-1">
            <p>
              • <strong>Shop Operators:</strong> Launch your installed <em>Printap Shop Agent</em> on the counter PC.
            </p>
            <p>
              • <strong>Platform Administrators:</strong> Launch the <em>Printap Platform Admin Console</em> desktop application.
            </p>
          </div>
        </div>

        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-black hover:bg-zinc-800 text-white text-xs font-semibold shadow-md transition"
          >
            <span>Return to Public Homepage</span>
            <span>→</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full pt-6 border-t border-zinc-200 flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <div>Printap • mellod.in</div>
        <div>STRICT ZERO-CLOUD ENFORCEMENT</div>
      </footer>
    </div>
  );
}
