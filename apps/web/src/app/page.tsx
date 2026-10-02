"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DemoDoc {
  name: string;
  pages: number;
  price: number;
}

const DEMO_DOCS: DemoDoc[] = [
  { name: "College_Admit_Card.pdf", pages: 1, price: 2 },
  { name: "Resume_2026_Final.pdf", pages: 2, price: 4 },
  { name: "Project_Thesis_Report.pdf", pages: 14, price: 28 },
];

export default function Home() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

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

  // Infinite Automated Live Print Simulator Loop
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [simStep, setSimStep] = useState<"idle" | "upload" | "pay" | "print" | "ready">("ready");

  const currentDoc = DEMO_DOCS[selectedDocIndex];

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (simStep === "idle") {
      timeout = setTimeout(() => setSimStep("upload"), 800);
    } else if (simStep === "upload") {
      timeout = setTimeout(() => setSimStep("pay"), 1200);
    } else if (simStep === "pay") {
      timeout = setTimeout(() => setSimStep("print"), 1400);
    } else if (simStep === "print") {
      timeout = setTimeout(() => setSimStep("ready"), 1600);
    } else if (simStep === "ready") {
      // Loop to next document automatically after showing ready state
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
      {/* ─── NAVIGATION BAR (No Sign-in option as requested) ─── */}
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

          {/* Single Focused Action CTA */}
          <div className="flex items-center">
            <Link
              href="/onboard"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            >
              <span>Open Your Shop</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION: SIMULATION ON LEFT, TEXT ON RIGHT ─── */}
      <section className="pt-8 sm:pt-14 pb-16 sm:pb-24 px-4 sm:px-6 relative overflow-hidden bg-mesh">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
          
          {/* ─── LEFT COLUMN: LIVE SIMULATION IN CONTINUOUS LOOP ─── */}
          <div className="lg:col-span-6 w-full order-2 lg:order-1">
            <div className="bg-white rounded-3xl border border-zinc-200/90 p-5 sm:p-7 shadow-xl relative overflow-hidden space-y-4">
              {/* Ticker / Status Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                    Live System Flow
                  </span>
                </div>
                <div className="text-[11px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                  Under 15 Seconds
                </div>
              </div>

              {/* Step 1: Customer Phone Card */}
              <div className="bg-zinc-50 rounded-2xl border border-zinc-200/90 p-4 space-y-2.5 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black uppercase tracking-wider text-zinc-700 bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-[10px]">
                    1. Customer Phone
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">shop.mellod.in</span>
                </div>

                {/* File representation */}
                <div className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      PDF
                    </span>
                    <div className="truncate">
                      <span className="text-xs font-bold text-zinc-950 block truncate">
                        {currentDoc.name}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {currentDoc.pages} {currentDoc.pages === 1 ? "page" : "pages"} • Black & White
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-zinc-950 shrink-0">
                    ₹{currentDoc.price}.00
                  </span>
                </div>

                {/* Simulated Payment */}
                <div>
                  {simStep === "idle" || simStep === "upload" ? (
                    <div className="w-full py-2 bg-zinc-100 text-zinc-500 text-xs font-bold rounded-xl text-center">
                      Selecting file...
                    </div>
                  ) : simStep === "pay" ? (
                    <div className="w-full py-2 bg-zinc-950 text-white text-xs font-bold rounded-xl text-center animate-pulse">
                      Paying ₹{currentDoc.price}.00 via UPI...
                    </div>
                  ) : (
                    <div className="w-full py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs">
                      <span>✓</span>
                      <span>Paid ₹{currentDoc.price}.00 to Shopkeeper</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Animated Connecting Pulse Line */}
              <div className="flex items-center justify-center py-1">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-0.5 bg-zinc-200 relative overflow-hidden rounded-full">
                    <div className="absolute inset-0 bg-zinc-950 rounded-full animate-beam-slide"></div>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Direct Transfer
                  </span>
                  <div className="w-16 h-0.5 bg-zinc-200 relative overflow-hidden rounded-full">
                    <div className="absolute inset-0 bg-zinc-950 rounded-full animate-beam-slide"></div>
                  </div>
                </div>
              </div>

              {/* Step 2: Shop Computer Terminal & Printer Output */}
              <div className="bg-zinc-950 text-white rounded-2xl p-4 border border-zinc-800 text-left space-y-3 font-mono">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-2 border-b border-zinc-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    2. Shop Counter PC
                  </span>
                  <span className="text-[10px] text-zinc-400">Canon / HP Ready</span>
                </div>

                <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                  <span className="truncate font-bold text-zinc-200">
                    Job #104: {currentDoc.name}
                  </span>
                  <span className="text-emerald-400 font-bold shrink-0">
                    ₹{currentDoc.price}.00 Paid
                  </span>
                </div>

                {/* Printed Sheet Ejection */}
                <div className="pt-1">
                  {simStep === "print" ? (
                    <div className="p-2.5 bg-zinc-800 rounded-xl text-center text-xs text-zinc-300 font-bold animate-pulse font-sans">
                      🖨️ Printing document now...
                    </div>
                  ) : simStep === "ready" ? (
                    <div className="bg-white text-zinc-950 rounded-xl p-3 shadow-md border border-zinc-200 animate-paper-slide space-y-1 font-sans">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span>📄 Printed Paper Ready</span>
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                          ✓ Finished
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-200 rounded-full w-4/5"></div>
                      <div className="h-1.5 bg-zinc-200 rounded-full w-2/3"></div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl text-center text-[11px] text-zinc-500 font-sans">
                      Waiting for incoming job...
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Micro Proof Strip */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                <span className="flex items-center gap-1 font-bold text-zinc-800">
                  <span className="text-emerald-600">✓</span> 0% Fee
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-zinc-800">
                  <span className="text-emerald-600">✓</span> Direct UPI
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-bold text-zinc-800">
                  <span className="text-emerald-600">✓</span> Zero WhatsApp
                </span>
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: EDITORIAL HEADLINE & VALUE PROPOSITION ─── */}
          <div className="lg:col-span-6 text-left space-y-6 order-1 lg:order-2">
            {/* Animated Announcement Beacon */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-zinc-200/90 text-zinc-800 text-xs font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-950"></span>
              </span>
              <span>The 15-Second Document Printing Network</span>
            </div>

            {/* Editorial Headline with Animated Word Cycler */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-zinc-950 tracking-tight leading-[1.08]">
              Print any document. <br />
              From your phone.{" "}
              <span className="relative inline-block text-zinc-400 font-extrabold transition-all duration-300 underline decoration-zinc-300 underline-offset-8">
                {rotatingWords[wordIndex]}
              </span>
            </h1>

            {/* Subtitle in Plain English */}
            <p className="text-base sm:text-lg text-zinc-600 font-normal leading-relaxed">
              Walk up to any counter, scan the QR code with your phone, pick your file, and pay with UPI.
              Your pages print out right away. No sharing phone numbers. No WhatsApp.
            </p>

            {/* Action Row - ONLY "Open Your Free Shop", NO "Test Live Simulation" button */}
            <div className="pt-2 space-y-2.5">
              <Link
                href="/onboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-zinc-950 hover:bg-zinc-800 text-white text-base font-black rounded-2xl shadow-lg shadow-zinc-950/15 hover:shadow-xl transition-all cursor-pointer hover:scale-[1.02] group"
              >
                <span>Open Your Free Shop</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <div className="text-xs text-zinc-500 font-medium">
                Free forever • Works on any Windows PC • Takes 2 minutes
              </div>
            </div>

            {/* Proof Badges Grid */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-100">
              <div className="bg-white p-3 rounded-xl border border-zinc-200/80 shadow-2xs">
                <div className="text-xl font-black text-zinc-950">0%</div>
                <div className="text-xs font-bold text-zinc-800">Zero Fees for Shops</div>
                <div className="text-[10px] text-zinc-400 font-medium">100% direct bank payout</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-zinc-200/80 shadow-2xs">
                <div className="text-xl font-black text-zinc-950">&lt; 15s</div>
                <div className="text-xs font-bold text-zinc-800">Queue Turnaround</div>
                <div className="text-[10px] text-zinc-400 font-medium">Instant paper in hand</div>
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
            href="/onboard"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-zinc-950 hover:bg-zinc-800 text-white text-base font-black rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
          >
            <span>Open Your Shop in 2 Minutes</span>
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

          <div className="flex items-center gap-6">
            <Link href="/onboard" className="hover:text-zinc-950 transition-colors">
              Open Shop
            </Link>
            <a href="#how-it-works" className="hover:text-zinc-950 transition-colors">
              How It Works
            </a>
            <a href="#faq" className="hover:text-zinc-950 transition-colors">
              Questions
            </a>
          </div>

          <div>
            © {new Date().getFullYear()} Mellod. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
