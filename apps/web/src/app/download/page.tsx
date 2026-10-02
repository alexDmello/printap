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
    <div className="min-h-screen bg-mesh py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center selection:bg-zinc-900 selection:text-white">
      <div className="max-w-2xl w-full space-y-6 animate-fade-in-up">
        {/* Main Download Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-zinc-200 shadow-lg space-y-8 text-center">
          {/* Header & Status */}
          <div className="space-y-3">
            <img src="/P.png" alt="Printap" className="w-14 h-14 rounded-2xl mx-auto shadow-xs" />

            <div className="inline-block px-3 py-1 bg-zinc-100 text-zinc-900 text-xs font-bold rounded-full tracking-wide border border-zinc-200">
              SHOP SETUP COMPLETED ✓
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
              {shopInfo?.name ? `${shopInfo.name} is Ready!` : "Download Printap Computer App"}
            </h1>

            <p className="text-sm text-zinc-600 max-w-md mx-auto font-medium">
              {countdown > 0
                ? `Your Windows app download will start automatically in ${countdown}s...`
                : downloadStarted
                ? "Your download has started! Open and install it on your shop computer."
                : "Click below to download the app for your shop computer."}
            </p>
          </div>

          {/* Primary Download Action Box */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center space-y-4">
            <button
              type="button"
              onClick={() => triggerDownload("setup")}
              className="w-full py-4 px-6 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-base rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer hover:scale-[1.01]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Printap for Windows (.exe)</span>
              <span className="text-xs font-mono bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-300">~82 MB</span>
            </button>

            <div className="flex items-center justify-center gap-4 text-xs text-zinc-500 font-medium">
              <span>Windows 10 / 11 (64-bit)</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => triggerDownload("portable")}
                className="text-zinc-900 hover:underline font-semibold cursor-pointer"
              >
                Portable Version (.exe)
              </button>
            </div>
          </div>

          {/* Customer Storefront Link */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">
                Your Shop&apos;s Customer Web Link
              </span>
              <span className="text-zinc-900 font-bold text-[11px]">● Live Now</span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-zinc-200 shadow-2xs">
              <span className="font-mono text-xs sm:text-sm text-zinc-950 font-bold truncate">
                {storefrontUrl}
              </span>
              <button
                type="button"
                onClick={copyStoreUrl}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <span>✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <span>Copy Link</span>
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Print this link or show its QR code on your counter desk so customers can upload documents easily.
            </p>
          </div>

          {/* Counter App Credentials Reminder */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-left space-y-2 text-xs">
            <span className="font-bold text-zinc-700 uppercase tracking-wider text-[11px] block">
              How to Sign Into the App on Your Computer:
            </span>
            <div className="space-y-1 font-mono text-[11px]">
              <div>
                <span className="text-zinc-500">Login ID:</span>{" "}
                <span className="text-zinc-950 font-bold">
                  {shopInfo?.owner_email || "Your Google Email"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Password:</span>{" "}
                <span className="text-zinc-950 font-bold">The password you just set</span>
              </div>
            </div>
          </div>

          {/* Quick Setup Instructions (3 Plain Steps) */}
          <div className="pt-2 border-t border-zinc-100 text-left space-y-3">
            <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">
              3 Quick Steps to Start:
            </h3>
            <ol className="space-y-2 text-xs text-zinc-600 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span>Open the downloaded file (<strong>Printap-Setup.exe</strong>) on your shop computer.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span>Log in using your email and password. Your connected printers will be detected automatically.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span>Show your shop&apos;s link or QR code to customers at your counter and start printing!</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-950 font-semibold transition-colors">
            ← Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <DownloadContent />
    </Suspense>
  );
}
