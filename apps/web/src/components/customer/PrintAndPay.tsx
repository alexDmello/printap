"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { UploadedDocument, QueueToken, PaymentMethod } from "@printap/shared";
import type { TransferProgress } from "@/lib/customer-signaling";
import AdSlot from "@/components/ads/AdSlot";

interface PrintAndPayProps {
  shopName: string;
  shopId: string;
  upiVpa: string;
  totalAmount: number;
  documents: UploadedDocument[];
  activeDocumentCount: number;
  token: QueueToken;
  progress?: TransferProgress | null;
  isPaymentConfirmed: boolean;
  onPrintAnother: () => void;
  onEditSettings?: () => void;
}

export default function PrintAndPay({
  shopName,
  shopId,
  upiVpa,
  totalAmount,
  documents,
  activeDocumentCount,
  token,
  progress,
  isPaymentConfirmed,
  onPrintAnother,
  onEditSettings,
}: PrintAndPayProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("upi");
  const [copiedToken, setCopiedToken] = useState(false);

  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(
    shopName
  )}&am=${totalAmount.toFixed(2)}&cu=INR&tn=Printap-${token.tokenCode}`;

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token.tokenCode);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Determine spooling status message
  const isTransferring = progress && progress.status === "sending";
  const isCompleteTransfer = (progress && progress.status === "complete") || !progress;
  const percent = progress?.percent ?? (isCompleteTransfer ? 100 : 0);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ─── 1. Top Rectangular / Video-Capable Ad Container ─── */}
      <AdSlot variant="rectangle" className="mb-2" />

      {/* ─── 2. Unified Master Card: Token + Spooling + Payment ─── */}
      <div className="glass rounded-3xl border border-zinc-200/90 shadow-md bg-white/95 overflow-hidden transition-all">
        
        {/* ── Top Header: Counter Token & Live Spooling Badge ── */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-zinc-50/80 to-white border-b border-zinc-100">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Token display */}
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                Counter Token
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono tracking-tight bg-zinc-100/90 px-3 py-0.5 rounded-xl border border-zinc-200/80 shadow-2xs">
                  {token.tokenCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-200/60 transition cursor-pointer active:scale-95"
                  title="Copy token code"
                >
                  {copiedToken ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* Right: Live Spooling status badge */}
            <div className="text-right flex flex-col items-end flex-shrink-0">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 border shadow-2xs ${
                  isCompleteTransfer
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-indigo-50 text-indigo-800 border-indigo-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCompleteTransfer
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-indigo-600 animate-ping"
                  }`}
                />
                <span>
                  {isCompleteTransfer
                    ? "Printing in Progress"
                    : isTransferring
                    ? "Streaming to Printer..."
                    : "Connecting..."}
                </span>
              </span>
              <span className="text-[10px] font-medium text-zinc-500 mt-1">
                {activeDocumentCount} {activeDocumentCount === 1 ? "doc" : "docs"} at{" "}
                <span className="font-bold text-zinc-800">{shopName}</span>
              </span>
            </div>
          </div>

          {/* Spooling Progress Bar & Filename */}
          <div className="mt-4 pt-3 border-t border-zinc-100/80">
            <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200/80 mb-1.5">
              <div
                className="bg-zinc-900 h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${isCompleteTransfer ? 100 : Math.max(percent, 8)}%`,
                }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-zinc-500">
              <span className="truncate max-w-[220px] sm:max-w-xs font-medium">
                📄 {progress?.currentFileName || documents[0]?.file?.name || "Print Order Document"}
              </span>
              <span className="font-mono font-bold text-zinc-800">
                {isCompleteTransfer ? "100% Spooled ✓" : `${percent}%`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Middle: Shop Confirmation State OR Payment Flow ── */}
        {isPaymentConfirmed ? (
          /* Payment Confirmed State */
          <div className="p-6 bg-emerald-50/70 border-b border-emerald-200 text-center animate-fade-in-up">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl font-black shadow-sm">
              ✓
            </div>
            <h2 className="text-lg font-black text-emerald-950">
              Payment Confirmed by Shop!
            </h2>
            <p className="text-xs text-emerald-800 mt-1 max-w-sm mx-auto">
              The counter operator at <span className="font-bold">{shopName}</span> has verified your payment of ₹{totalAmount.toFixed(2)}.
            </p>

            <div className="mt-4 p-3 bg-white/95 rounded-xl border border-emerald-200 inline-block text-xs font-semibold text-zinc-800 shadow-2xs">
              👉 Please collect your printout with Token <span className="font-mono font-bold text-zinc-950">{token.tokenCode}</span>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={onPrintAnother}
                className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white shadow-sm transition cursor-pointer"
              >
                Print Another Document
              </button>
            </div>
          </div>
        ) : (
          /* Unconfirmed / Payment Section */
          <div className="p-4 sm:p-6 space-y-4">
            {/* Awaiting verification banner */}
            <div className="rounded-xl p-3 border border-amber-200/80 bg-amber-50/70 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
                <span>Awaiting Counter Verification</span>
              </div>
              {onEditSettings && (
                <button
                  type="button"
                  onClick={onEditSettings}
                  className="text-[11px] font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950 flex-shrink-0 cursor-pointer"
                >
                  Change settings
                </button>
              )}
            </div>

            {/* Total Amount & Method Tabs Row */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">
                  Total Amount Due
                </span>
                <span className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl border border-zinc-200/80 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedMethod("upi")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedMethod === "upi"
                      ? "bg-zinc-900 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  📱 UPI QR
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMethod("cash")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedMethod === "cash"
                      ? "bg-zinc-900 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  💵 Cash
                </button>
              </div>
            </div>

            {/* ── UPI Method Content ── */}
            {selectedMethod === "upi" && (
              <div className="text-center pt-1">
                <p className="text-xs font-bold text-zinc-700 mb-3">
                  Scan with any UPI App (GPay / PhonePe / Paytm / BHIM)
                </p>

                <div className="bg-white rounded-2xl p-3.5 mx-auto w-fit shadow-xs border border-zinc-200/80">
                  <QRCodeSVG
                    value={upiUrl}
                    size={165}
                    level="M"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#111111"
                  />
                </div>

                <div className="mt-3 text-xs text-zinc-500">
                  UPI ID: <span className="font-mono font-bold text-zinc-800">{upiVpa}</span>
                </div>

                <a
                  href={upiUrl}
                  className="mt-3.5 inline-block w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs tracking-wide text-center transition shadow-xs cursor-pointer active:scale-[0.99]"
                >
                  Tap to Open in UPI App (₹{totalAmount.toFixed(2)})
                </a>
              </div>
            )}

            {/* ── Cash Method Content ── */}
            {selectedMethod === "cash" && (
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center text-xl shadow-2xs">
                  💵
                </div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Pay Cash Directly at the Counter
                </h3>
                <p className="text-xs text-zinc-600 mt-1 max-w-xs mx-auto">
                  Hand <span className="font-bold text-zinc-900 font-mono">₹{totalAmount.toFixed(2)}</span> to the shop staff. They will click &quot;Confirm Payment&quot; on the live terminal to hand over your printout.
                </p>
              </div>
            )}

            {/* Payment & Refund Legal Disclosure */}
            <div className="pt-3 border-t border-zinc-100 text-center">
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Payments are deposited directly to {shopName}. By paying, you agree to Printap&apos;s{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 underline underline-offset-1 hover:text-zinc-900"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="/refund-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 underline underline-offset-1 hover:text-zinc-900"
                >
                  Refund Policy
                </a>
                .
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
