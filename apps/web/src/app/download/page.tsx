"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-client";

function DownloadContent() {
  const searchParams = useSearchParams();
  const slugParam = searchParams.get("shop") || "";

  const [shopInfo, setShopInfo] = useState<{
    name: string;
    slug: string;
    owner_email: string;
  } | null>(null);

  const [downloadStarted, setDownloadStarted] = useState(false);
  const [countdown, setCountdown] = useState(2);
  const [copied, setCopied] = useState(false);

  // Fetch shop details if slug provided or from active Supabase session
  useEffect(() => {
    async function loadShop() {
      const supabase = getBrowserSupabase();
      let email: string | null = null;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.email) {
        email = session.user.email.toLowerCase().trim();
      }

      if (slugParam) {
        const { data } = await supabase
          .from("shops")
          .select("name, slug, owner_email")
          .eq("slug", slugParam)
          .maybeSingle();

        if (data) {
          setShopInfo(data);
          return;
        }
      }

      if (email) {
        const { data } = await supabase
          .from("shops")
          .select("name, slug, owner_email")
          .eq("owner_email", email)
          .maybeSingle();

        if (data) {
          setShopInfo(data);
        }
      }
    }

    loadShop();
  }, [slugParam]);

  // Trigger file download in the current page via programmatic anchor click
  const triggerDownload = (type: "setup" | "portable" = "setup") => {
    const downloadUrl = `/api/download/setup${type === "portable" ? "?type=portable" : ""}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = type === "portable" ? "Printap-Portable.exe" : "Printap-Setup.exe";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadStarted(true);
  };

  // Automatic download trigger countdown (2 seconds)
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!downloadStarted) {
      triggerDownload("setup");
    }
  }, [countdown, downloadStarted]);

  const activeSlug = shopInfo?.slug || slugParam || "your-shop";
  const storefrontUrl = `https://${activeSlug}.mellod.in`;

  const copyStoreUrl = () => {
    navigator.clipboard.writeText(storefrontUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-mesh py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-6 animate-fadeIn">
        {/* Main Download Card */}
        <div className="glass-strong rounded-3xl p-8 sm:p-10 border border-zinc-200/90 shadow-2xl space-y-8 text-center">
          {/* Header & Status */}
          <div className="space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full tracking-wide">
              STORE REGISTERED SUCCESSFULLY
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
              {shopInfo?.name ? `${shopInfo.name} is Ready!` : "Download Printap Counter Agent"}
            </h1>

            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              {countdown > 0
                ? `Your Windows desktop setup installer will download automatically in ${countdown}s...`
                : downloadStarted
                ? "Your download has started! Run the installer on your counter PC."
                : "Click below to download the Windows desktop terminal installer."}
            </p>
          </div>

          {/* Primary Download Action Box */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/40 border border-indigo-100/90 rounded-2xl p-6 text-center space-y-4 shadow-sm">
            <button
              type="button"
              onClick={() => triggerDownload("setup")}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-3 cursor-pointer group hover:scale-[1.01]"
            >
              <svg className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Printap for Windows (.exe)</span>
              <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded-full">~82 MB</span>
            </button>

            <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
              <span>Windows 10 / 11 64-bit</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => triggerDownload("portable")}
                className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
              >
                Download Portable Version (.exe)
              </button>
            </div>
          </div>

          {/* Customer Storefront Link */}
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">
                Your Branded Customer Print URL
              </span>
              <span className="text-emerald-600 font-semibold text-[11px]">● Live & Accepting Orders</span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-zinc-200 shadow-sm">
              <span className="font-mono text-xs sm:text-sm text-indigo-700 font-bold truncate">
                {storefrontUrl}
              </span>
              <button
                type="button"
                onClick={copyStoreUrl}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <span className="text-emerald-600">✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <span>Copy Link</span>
                )}
              </button>
            </div>
          </div>

          {/* Counter Terminal Login Info */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 text-left space-y-3">
            <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Desktop Counter Agent Sign-In Credentials</span>
            </div>
            <p className="text-xs text-indigo-900/80 leading-relaxed">
              Open the downloaded <strong>Printap-Setup.exe</strong> and log in with your account credentials:
            </p>
            <div className="bg-white p-3.5 rounded-xl border border-indigo-200 text-xs space-y-1.5 font-mono">
              <div>
                <strong className="text-zinc-600">Login Email:</strong>{" "}
                <span className="text-zinc-900 font-bold">{shopInfo?.owner_email || "Your Google Account Email"}</span>
              </div>
              <div>
                <strong className="text-zinc-600">Subdomain Handle:</strong>{" "}
                <span className="text-indigo-600 font-bold">{activeSlug}</span>
              </div>
              <div>
                <strong className="text-zinc-600">Password:</strong>{" "}
                <span className="text-zinc-500 font-sans italic">The counter password you specified during setup</span>
              </div>
            </div>
          </div>

          {/* Quick 3-Step Setup Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div className="text-xs font-bold text-zinc-900">Run Installer</div>
              <p className="text-[11px] text-zinc-500">
                Launch <code>Printap-Setup.exe</code> on your Windows counter PC.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div className="text-xs font-bold text-zinc-900">Sign In</div>
              <p className="text-[11px] text-zinc-500">
                Log in with your Google email & terminal password.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div className="text-xs font-bold text-zinc-900">Auto Print</div>
              <p className="text-[11px] text-zinc-500">
                Incoming student print orders sync to your counter printer.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-3 px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold rounded-xl text-center transition-colors"
            >
              Open Customer Storefront →
            </a>
            <Link
              href="/"
              className="py-3 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-semibold rounded-xl text-center transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <DownloadContent />
    </Suspense>
  );
}
