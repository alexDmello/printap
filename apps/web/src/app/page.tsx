"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-client";
import { enforceSessionTimeout } from "@/lib/session-manager";

interface DemoDoc {
  name: string;
  pages: number;
  price: number;
  type: string;
}

const DEMO_DOCS: DemoDoc[] = [
  { name: "College_Admit_Card.pdf", pages: 1, price: 2, type: "PDF Document" },
  { name: "Resume_2026_Final.pdf", pages: 2, price: 4, type: "Job Application" },
  { name: "Project_Thesis_Report.pdf", pages: 14, price: 28, type: "College Notes" },
];

export default function Home() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [userShopSlug, setUserShopSlug] = useState<string | null>(null);

  // 1. If user landed on root with OAuth tokens/code, immediately forward to /auth/callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("access_token") ||
        hash.includes("error") ||
        search.includes("code=") ||
        search.includes("error=")
      ) {
        window.location.replace(`/auth/callback${search}${hash}`);
      }
    }
  }, []);

  // 2. Check if logged-in user already has an onboarded shop
  useEffect(() => {
    try {
      const supabase = getBrowserSupabase();
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user?.email) {
          const { valid } = await enforceSessionTimeout(supabase);
          if (!valid) {
            setUserShopSlug(null);
            return;
          }

          const { data: existingShop } = await supabase
            .from("shops")
            .select("slug")
            .ilike("owner_email", session.user.email.toLowerCase().trim())
            .limit(1)
            .maybeSingle();

          if (existingShop?.slug) {
            setUserShopSlug(existingShop.slug);
          }
        }
      });
    } catch {
      // Ignore background check failure
    }
  }, []);

  // Rotating Headline Words
  const rotatingWords = [
    "in 15 seconds.",
    "with zero waiting.",
    "without WhatsApp.",
    "100% privately.",
  ];
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [rotatingWords.length]);

  // Continuous Auto-Looping Live Print Simulator State
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [simStep, setSimStep] = useState<"idle" | "upload" | "pay" | "print" | "ready">("ready");

  const currentDoc = DEMO_DOCS[selectedDocIndex];

  // Infinite, automated continuous simulation loop
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (simStep === "idle") {
      timeout = setTimeout(() => setSimStep("upload"), 700);
    } else if (simStep === "upload") {
      timeout = setTimeout(() => setSimStep("pay"), 1100);
    } else if (simStep === "pay") {
      timeout = setTimeout(() => setSimStep("print"), 1300);
    } else if (simStep === "print") {
      timeout = setTimeout(() => setSimStep("ready"), 1600);
    } else if (simStep === "ready") {
      timeout = setTimeout(() => {
        setSelectedDocIndex((prev) => (prev + 1) % DEMO_DOCS.length);
        setSimStep("idle");
      }, 3500);
    }

    return () => clearTimeout(timeout);
  }, [simStep, selectedDocIndex]);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-900 selection:text-white">
      {/* ─── NAVIGATION BAR (Sign-in option removed) ─── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-200/90 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/P.png"
              alt="Printap Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-zinc-950 leading-none">
                Printap
              </span>
              <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase mt-0.5">
                by Mellod
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-600">
            <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">
              How It Works
            </a>
            <a href="#for-shops" className="hover:text-zinc-950 transition-colors">
              For Print Shops
            </a>
            <a href="#for-customers" className="hover:text-zinc-950 transition-colors">
              For Customers
            </a>
            <a href="#faq" className="hover:text-zinc-950 transition-colors">
              Questions
            </a>
          </nav>

          {/* Single Clear Action CTA */}
          <div className="flex items-center">
            <Link
              href={userShopSlug ? `/download?shop=${encodeURIComponent(userShopSlug)}` : "/onboard"}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            >
              <span>{userShopSlug ? "My Shop Terminal" : "Open Your Shop"}</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── 2-COLUMN HERO SECTION: TEXT LEFT, FIXED-SIZE SIMULATION RIGHT ─── */}
      <section className="pt-8 sm:pt-14 pb-16 sm:pb-20 px-4 sm:px-6 relative overflow-hidden bg-mesh">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
          
          {/* LEFT COLUMN: HERO HEADLINE & TEXT */}
          <div className="lg:col-span-6 text-left space-y-6 sm:space-y-7 animate-fade-in-up">
            {/* Animated Announcement Beacon */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white border border-zinc-200/90 text-zinc-800 text-xs font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-950"></span>
              </span>
              <span className="tracking-wide">15-Second Document Printing Network</span>
              <span className="text-zinc-300">•</span>
              <span className="text-zinc-500 font-semibold">100% Free</span>
            </div>

            {/* Editorial Headline with Animated Word Cycler (Strictly 1 line to eliminate layout shift) */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[40px] xl:text-[46px] 2xl:text-5xl font-black text-zinc-950 tracking-tight leading-[1.14]">
                <span className="block">Print any document.</span>
                <span className="block">From your phone.</span>
                <span className="block h-[1.28em] overflow-visible">
                  <span className="relative inline-block text-zinc-400 font-extrabold transition-all duration-300 underline decoration-zinc-300 underline-offset-8 whitespace-nowrap">
                    {rotatingWords[wordIndex]}
                  </span>
                </span>
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 font-normal leading-relaxed pt-1 max-w-lg">
                Walk up to any counter, scan the QR code with your phone, pick your file, and pay with UPI.
                Your pages print out right away. No sharing phone numbers. No WhatsApp.
              </p>
            </div>

            {/* CTA Button Row (No test button) */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <Link
                href={userShopSlug ? `/download?shop=${encodeURIComponent(userShopSlug)}` : "/onboard"}
                className="w-full sm:w-auto px-8 py-4 bg-zinc-950 hover:bg-zinc-800 text-white text-base font-black rounded-2xl shadow-lg shadow-zinc-950/15 hover:shadow-xl transition-all cursor-pointer hover:scale-[1.02] flex items-center justify-center gap-2 group"
              >
                <span>{userShopSlug ? "Go to Shop Terminal" : "Open Your Free Shop"}</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>

              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-zinc-50 text-zinc-900 text-sm sm:text-base font-bold rounded-2xl border border-zinc-200/90 shadow-2xs transition-all hover:border-zinc-400 text-center"
              >
                See How It Works ↓
              </a>
            </div>

            {/* 3 Quick Proof Metric Badges */}
            <div className="pt-2 grid grid-cols-3 gap-3 border-t border-zinc-200/80 max-w-lg">
              <div>
                <div className="text-2xl font-black text-zinc-950">0%</div>
                <div className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Platform Fees
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-zinc-950">&lt; 15s</div>
                <div className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Turnaround
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-zinc-950">100%</div>
                <div className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Direct to Bank
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: STRICTLY FIXED-SIZE LIVE SIMULATION (NEVER CHANGES SIZE) */}
          <div className="lg:col-span-6 w-full flex justify-center lg:justify-end animate-fade-in-up">
            <div className="w-full max-w-[480px] h-[550px] min-h-[550px] max-h-[550px] bg-white rounded-3xl border border-zinc-200/90 shadow-xl p-5 sm:p-6 flex flex-col justify-between overflow-hidden relative select-none">
              
              {/* Header: Fixed Height (h-8) */}
              <div className="h-8 shrink-0 flex items-center justify-between border-b border-zinc-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                    Live Counter Flow
                  </span>
                </div>
                <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                  {currentDoc.name.split("_")[0]} • ₹{currentDoc.price}.00
                </span>
              </div>

              {/* Station 1: Customer Phone (Fixed Height: 185px) */}
              <div className="h-[185px] shrink-0 bg-zinc-50 rounded-2xl border border-zinc-200/90 p-3.5 flex flex-col justify-between text-left">
                <div className="h-5 shrink-0 flex items-center justify-between text-[10px]">
                  <span className="font-black uppercase tracking-wider text-zinc-500 bg-white px-2 py-0.5 rounded-md border border-zinc-200">
                    1. Customer Phone
                  </span>
                  <div className="font-mono text-zinc-600 bg-white px-2 py-0.5 rounded border border-zinc-200 truncate max-w-[150px]">
                    🔒 shop.mellod.in
                  </div>
                </div>

                {/* File Row (Fixed Height: 56px) */}
                <div className="h-14 shrink-0 bg-white rounded-xl border border-zinc-200 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      PDF
                    </span>
                    <div className="truncate">
                      <div className="text-xs font-bold text-zinc-950 truncate">{currentDoc.name}</div>
                      <div className="text-[10px] text-zinc-500">{currentDoc.pages} {currentDoc.pages === 1 ? "page" : "pages"} • Black & White</div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-zinc-900 shrink-0">₹{currentDoc.price}.00</span>
                </div>

                {/* Payment State Button (Fixed Height: 36px) */}
                <div className="h-9 shrink-0">
                  {simStep === "idle" || simStep === "upload" ? (
                    <div className="w-full h-full bg-zinc-100 text-zinc-500 text-xs font-bold rounded-xl flex items-center justify-center">
                      Selecting file...
                    </div>
                  ) : simStep === "pay" ? (
                    <div className="w-full h-full bg-zinc-950 text-white text-xs font-bold rounded-xl flex items-center justify-center animate-pulse">
                      Paying ₹{currentDoc.price}.00 via UPI...
                    </div>
                  ) : (
                    <div className="w-full h-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs">
                      <span>✓</span>
                      <span>Paid ₹{currentDoc.price}.00 to Shopkeeper</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connecting Signal Beam (Fixed Height: 28px) */}
              <div className="h-7 shrink-0 flex items-center justify-between px-2 text-[10px] text-zinc-400 font-bold">
                <span>From Phone</span>
                <div className="relative w-36 h-1 bg-zinc-200 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-zinc-950 rounded-full animate-beam-slide"></div>
                </div>
                <span>Direct Transfer (&lt;1s)</span>
              </div>

              {/* Station 2: Counter Terminal & Printer (Fixed Height: 195px) */}
              <div className="h-[195px] shrink-0 bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-3.5 flex flex-col justify-between text-left font-mono">
                <div className="h-6 shrink-0 flex items-center justify-between text-[10px] pb-1 border-b border-zinc-800 text-zinc-400">
                  <span>2. Shop Counter Terminal</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Printer Ready
                  </span>
                </div>

                {/* Job Info (Fixed Height: 44px) */}
                <div className="h-11 shrink-0 bg-zinc-900 rounded-xl px-3 flex items-center justify-between text-xs">
                  <div className="truncate">
                    <span className="text-zinc-200 font-bold block truncate">Job: {currentDoc.name}</span>
                    <span className="text-[10px] text-zinc-400 block">{currentDoc.pages} pgs • Auto-Print</span>
                  </div>
                  <span className="text-emerald-400 font-bold shrink-0">₹{currentDoc.price}.00 Paid</span>
                </div>

                {/* Paper Output Slot (Fixed Height: 60px) */}
                <div className="h-[60px] shrink-0 overflow-hidden relative flex items-center justify-center">
                  {simStep === "print" ? (
                    <div className="w-full h-full bg-zinc-900 rounded-xl flex items-center justify-center text-xs text-zinc-300 font-bold animate-pulse">
                      🖨️ Printing document...
                    </div>
                  ) : simStep === "ready" ? (
                    <div className="w-full h-full bg-white text-zinc-950 rounded-xl px-3 py-2 shadow-md border border-zinc-200 animate-paper-slide flex items-center justify-between font-sans">
                      <div>
                        <div className="text-xs font-black">📄 Printed Sheet Ready</div>
                        <div className="text-[10px] text-zinc-500 font-medium">{currentDoc.pages} pages output</div>
                      </div>
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md text-[10px] font-bold">
                        ✓ Collected
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-zinc-900/40 rounded-xl flex items-center justify-center text-[10px] text-zinc-500 font-sans">
                      Waiting for incoming print...
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Status: Fixed Height (h-6) */}
              <div className="h-6 shrink-0 flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-zinc-100 font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse"></span>
                  Continuous Loop
                </span>
                <span>100% Direct Bank Settlement</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─── THE OLD WAY VS THE PRINTAP WAY ─── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-zinc-100">
        <div className="text-center space-y-3 mb-12 max-w-xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Why It Matters
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Printing used to be frustrating.
          </h2>
          <p className="text-sm text-zinc-600 font-medium">
            Here is why students, customers, and shop owners are switching to Printap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* The Old Way */}
          <div className="p-6 sm:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-zinc-500 font-black text-sm uppercase tracking-wide">
              <span>✕ The Old Way</span>
            </div>
            <ul className="space-y-3 text-sm text-zinc-600 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-400 font-bold">✕</span>
                <span>Giving your personal phone number to strangers at the counter.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-400 font-bold">✕</span>
                <span>Sending private documents over WhatsApp or Telegram chats.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-400 font-bold">✕</span>
                <span>Shop owners digging through messy downloads folders to find files.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-400 font-bold">✕</span>
                <span>Asking for UPI QR codes and hunting for exact cash change.</span>
              </li>
            </ul>
          </div>

          {/* The Printap Way */}
          <div className="p-6 sm:p-8 bg-white border-2 border-zinc-900 rounded-3xl space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-950 font-black text-sm uppercase tracking-wide">
              <span>✓ The Printap Way</span>
            </div>
            <ul className="space-y-3 text-sm text-zinc-900 font-semibold">
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-950 font-black">✓</span>
                <span><strong>100% Private:</strong> No phone numbers shared. Documents go straight to print.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-950 font-black">✓</span>
                <span><strong>Super Fast:</strong> Under 30 seconds from scanning the code to holding paper.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-950 font-black">✓</span>
                <span><strong>Clean Computer:</strong> Files print directly without cluttering the shop PC.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-zinc-950 font-black">✓</span>
                <span><strong>Instant UPI:</strong> Customers pay through UPI; 100% of money lands in your bank.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── 3 SIMPLE STEPS (HOW IT WORKS) ─── */}
      <section id="how-it-works" className="py-12 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-zinc-100">
        <div className="text-center space-y-3 mb-12 max-w-xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Customer Guide
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            How to print in 3 easy steps
          </h2>
          <p className="text-sm text-zinc-600 font-medium">
            No installation, no login, no sign-up for customers. Just scan and print.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 space-y-3 shadow-2xs hover:border-zinc-400 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-950 flex items-center justify-center font-black text-base">
              1
            </div>
            <h3 className="text-lg font-bold text-zinc-950">Scan the QR Code</h3>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">
              Open your phone&apos;s camera app and point it at the QR code displayed on the shop counter.
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 space-y-3 shadow-2xs hover:border-zinc-400 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-950 flex items-center justify-center font-black text-base">
              2
            </div>
            <h3 className="text-lg font-bold text-zinc-950">Upload & Pay</h3>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">
              Select your PDF, notes, or photos. Choose black & white or color, and pay securely using any UPI app.
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-7 space-y-3 shadow-2xs hover:border-zinc-400 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-950 flex items-center justify-center font-black text-base">
              3
            </div>
            <h3 className="text-lg font-bold text-zinc-950">Collect Your Print</h3>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium">
              The shopkeeper&apos;s printer immediately outputs your document. Pick it up and you are done!
            </p>
          </div>
        </div>
      </section>

      {/* ─── FOR PRINT SHOP OWNERS ─── */}
      <section id="for-shops" className="py-12 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-zinc-100">
        <div className="text-center space-y-3 mb-12 max-w-xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            For Print Shops
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Built to make running your shop easier
          </h2>
          <p className="text-sm text-zinc-600 font-medium">
            Everything you need to speed up customer queues and simplify counter payments.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-6 sm:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
              ₹
            </div>
            <h3 className="text-lg font-bold text-zinc-950">100% Free • 0% Commission</h3>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
              Every rupee paid by customers goes straight to your own UPI bank account. Printap charges zero commission and holds zero money.
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
              📱
            </div>
            <h3 className="text-lg font-bold text-zinc-950">No More WhatsApp Numbers</h3>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
              Never share your personal mobile number with customers again. They upload documents cleanly through your dedicated shop link.
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
              🖥️
            </div>
            <h3 className="text-lg font-bold text-zinc-950">Clean Counter Computer</h3>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
              Print jobs arrive in a neat list showing file names, pages, and colors. No chaotic Downloads folder. No pen drive viruses.
            </p>
          </div>

          <div className="p-6 sm:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-zinc-950">Works with Any Printer</h3>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
              Compatible with all standard desktop printers (HP, Canon, Epson, Brother, Ricoh). Works on any regular Windows PC.
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href={userShopSlug ? `/download?shop=${encodeURIComponent(userShopSlug)}` : "/onboard"}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-zinc-950 hover:bg-zinc-800 text-white text-base font-black rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
          >
            <span>{userShopSlug ? "Open Counter Terminal" : "Open Your Shop in 2 Minutes"}</span>
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* ─── FREQUENTLY ASKED QUESTIONS (FAQ) ─── */}
      <section id="faq" className="py-12 sm:py-20 px-4 sm:px-6 max-w-4xl mx-auto border-t border-zinc-100">
        <div className="text-center space-y-3 mb-10 max-w-lg mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Got Questions?
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Frequently asked questions
          </h2>
          <p className="text-sm text-zinc-600 font-medium">
            Clear, honest answers in plain words.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "Do customers need to download an app to print?",
              a: "No! Customers do not need to install anything. They just point their phone camera at your shop's QR code. It opens right in their browser (Chrome, Safari, etc.).",
            },
            {
              q: "How does the shop owner receive money?",
              a: "When a customer pays via UPI, the payment goes directly from the customer's bank account to your shop's UPI account (Google Pay, PhonePe, Paytm, or bank UPI). Printap takes 0% cut and does not hold your money.",
            },
            {
              q: "What types of files can customers print?",
              a: "Customers can print PDFs, Microsoft Word documents, presentations, images, ID card scans, and college study notes.",
            },
            {
              q: "What computer and printers do I need?",
              a: "Any regular Windows PC connected to your existing printers (Canon, HP, Epson, Brother, Ricoh, etc.). You simply download the small Printap app on your computer once.",
            },
            {
              q: "Are the customer's documents kept safe and private?",
              a: "Yes. Documents are transferred securely only to print them. Once printed, they are not stored or kept. No customer files are ever sold or shared.",
            },
            {
              q: "Is it really free for shop owners?",
              a: "Yes. Setting up your shop and downloading the counter app is completely free. You keep 100% of all customer payments.",
            },
          ].map((faq, index) => {
            const isOpen = activeFaq === index;
            return (
              <div
                key={faq.q}
                className="bg-white border border-zinc-200 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-5 font-bold text-zinc-900 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  <span className="text-zinc-400 font-mono text-lg shrink-0">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed border-t border-zinc-100">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── BOTTOM CALL TO ACTION BANNER ─── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="bg-zinc-950 text-white rounded-3xl p-8 sm:p-14 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="max-w-xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Ready to upgrade your print counter?
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed">
              Open your free shop in less than two minutes. Give customers the fastest printing experience in your area.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/onboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-zinc-100 text-zinc-950 text-base font-black rounded-2xl shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            >
              <span>Get Started Now (It&apos;s Free)</span>
              <span>→</span>
            </Link>
          </div>

          <div className="pt-4 text-xs text-zinc-500 font-medium">
            Takes under 2 minutes • No credit card required • Works on any Windows PC
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-zinc-200 py-10 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500 font-medium">
          <div className="flex items-center gap-2.5">
            <img src="/P.png" alt="Printap" className="w-6 h-6 rounded-lg" />
            <span className="font-extrabold text-zinc-900 text-sm">Printap</span>
            <span>·</span>
            <span>Simple document printing for counters</span>
          </div>

          <div className="flex items-center gap-6 flex-wrap justify-center">
            <Link href="/onboard" className="hover:text-zinc-950 transition-colors">
              Open Shop
            </Link>
            <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">
              How It Works
            </a>
            <a href="#faq" className="hover:text-zinc-950 transition-colors">
              Questions
            </a>
            <span className="text-zinc-200">|</span>
            <Link href="/terms" className="hover:text-zinc-950 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-zinc-950 transition-colors">
              Privacy
            </Link>
            <Link href="/refund-policy" className="hover:text-zinc-950 transition-colors">
              Refund Policy
            </Link>
            <Link href="/contact" className="hover:text-zinc-950 transition-colors">
              Contact
            </Link>
          </div>

          <div>
            © {new Date().getFullYear()} Mellod. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
