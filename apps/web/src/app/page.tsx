"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-900 selection:text-white">
      {/* ─── NAVIGATION BAR ─── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 transition-all">
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

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/onboard"
              className="text-xs sm:text-sm font-bold text-zinc-700 hover:text-zinc-950 px-3 py-2 rounded-xl hover:bg-zinc-100 transition-colors"
            >
              Shop Login
            </Link>
            <Link
              href="/onboard"
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            >
              <span>Open Your Shop</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 relative overflow-hidden bg-mesh">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 animate-fade-in-up">
          {/* Tagline Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-zinc-900 animate-pulse"></span>
            <span>The easiest way to print documents at any counter</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-zinc-950 tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Skip the counter line.{" "}
            <span className="text-zinc-500 font-extrabold block sm:inline">
              Print from your phone in seconds.
            </span>
          </h1>

          {/* Subtitle in Plain English */}
          <p className="text-base sm:text-xl text-zinc-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Walk up to any print shop, scan their counter QR code, pick your document, and pay with UPI.
            No sending files on WhatsApp. No sharing personal phone numbers.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
            <Link
              href="/onboard"
              className="w-full sm:w-auto px-8 py-4 bg-zinc-950 hover:bg-zinc-800 text-white text-base font-black rounded-2xl shadow-lg shadow-zinc-950/15 hover:shadow-xl transition-all cursor-pointer hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <span>Register Your Print Shop (Free)</span>
              <span>→</span>
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-7 py-4 bg-white hover:bg-zinc-50 text-zinc-900 text-base font-bold rounded-2xl border border-zinc-200/90 shadow-2xs transition-all hover:border-zinc-400"
            >
              See How It Works
            </a>
          </div>

          {/* Key Proof Points in Plain Words */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
            <div className="bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-sm text-zinc-900">
                0%
              </span>
              <div className="text-xs font-bold text-zinc-800">
                Zero Fees for Shops
                <span className="block text-[11px] text-zinc-500 font-medium">100% direct UPI to your bank</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-sm text-zinc-900">
                ⚡
              </span>
              <div className="text-xs font-bold text-zinc-800">
                Under 30 Seconds
                <span className="block text-[11px] text-zinc-500 font-medium">From upload to printed paper</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-sm text-zinc-900">
                🔒
              </span>
              <div className="text-xs font-bold text-zinc-800">
                Completely Private
                <span className="block text-[11px] text-zinc-500 font-medium">No files left behind</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LIVE INTERACTIVE VISUAL DEMONSTRATION ─── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
          <div className="text-center space-y-2 max-w-lg mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Simple & Clean
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              How Printap works at the counter
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 font-medium">
              Two sides working together seamlessly: the customer&apos;s phone and the shopkeeper&apos;s computer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Step A: Customer Experience */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full">
                    1. On Customer&apos;s Phone
                  </span>
                  <span className="text-xs font-bold text-emerald-600">No App Needed</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-950">
                  Scan, upload, and pay directly
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Open your camera, point it at the counter QR code, pick your files, and tap your favorite UPI app (Google Pay, PhonePe, Paytm).
                </p>
              </div>

              {/* Simulated Customer UI Preview */}
              <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-3 font-sans">
                <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-200/80">
                  <img src="/P.png" alt="Printap" className="w-6 h-6 rounded-md" />
                  <span className="text-xs font-bold text-zinc-900">Campus Xerox & Prints</span>
                  <span className="text-[10px] text-zinc-400 ml-auto font-mono">shop.mellod.in</span>
                </div>
                <div className="border-2 border-dashed border-zinc-200 bg-white rounded-lg p-3 text-center">
                  <span className="text-xs font-bold text-zinc-700 block">Resume_Final.pdf (2 pages)</span>
                  <span className="text-[10px] text-zinc-400">Total: ₹4.00 • Black & White</span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-950">Paid via Google Pay</span>
                  <span className="text-emerald-700 font-extrabold">✓ Completed</span>
                </div>
              </div>
            </div>

            {/* Step B: Shopkeeper Experience */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full">
                    2. On Shop Computer
                  </span>
                  <span className="text-xs font-bold text-zinc-700">1-Click Print</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-950">
                  Instant print job on your screen
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  The document arrives on your counter computer the moment payment is confirmed. Click print and hand the paper to the customer.
                </p>
              </div>

              {/* Simulated Shopkeeper Terminal UI Preview */}
              <div className="bg-zinc-950 text-white rounded-xl border border-zinc-800 p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-bold">Printap Counter Agent</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">HP LaserJet Ready</span>
                </div>
                <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800 space-y-1">
                  <div className="flex justify-between font-bold text-zinc-200">
                    <span>Job #102: Resume_Final.pdf</span>
                    <span className="text-emerald-400">₹4.00 Received</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">2 Pages • 1 Copy • Black & White</div>
                </div>
                <div className="w-full py-1.5 bg-white text-zinc-950 font-bold rounded text-center text-[11px]">
                  ✓ Document Sent to Printer
                </div>
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
              Shop Onboarding
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
