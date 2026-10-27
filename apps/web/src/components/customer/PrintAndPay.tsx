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
    <div className="space-y-2 animate-fade-in-up">
      {/* ─── 1. Top Borderless Rectangular / Video-Capable Ad Container ─── */}
      <AdSlot variant="rectangle" compact className="mb-0.5" />

      {/* ─── 2. Ultra-Compact Master Card (Token + QR + Payment - Zero Scroll) ─── */}
      <div className="glass rounded-2xl shadow-sm bg-white/95 overflow-hidden transition-all p-3 sm:p-4">
        
        {/* ── Header Row: Token, Spooling Badge & Amount Due (All in 1 Row) ── */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-100">
          {/* Left: Token */}
          <div className="flex items-center gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-zinc-900 font-mono tracking-tight bg-zinc-100 px-2.5 py-0.5 rounded-lg border border-zinc-200/80 shadow-2xs">
              {token.tokenCode}
            </span>
            <button
              type="button"
              onClick={handleCopyToken}
              className="text-[10px] font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-md transition cursor-pointer active:scale-95"
              title="Copy token code"
            >
              {copiedToken ? "Copied ✓" : "Copy"}
            </button>
          </div>

          {/* Center/Right: Live Status & Amount */}
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border shadow-2xs ${
                isCompleteTransfer
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-indigo-50 text-indigo-800 border-indigo-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCompleteTransfer
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-indigo-600 animate-ping"
                }`}
              />
              <span>{isCompleteTransfer ? "Ready" : `${percent}% Spooling`}</span>
            </span>

            <span className="text-base sm:text-lg font-black text-zinc-900 font-mono tracking-tight">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Micro Spooling Progress Bar */}
        <div className="py-1.5">
          <div className="w-full bg-zinc-100 rounded-full h-1 overflow-hidden">
            <div
              className="bg-zinc-900 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${isCompleteTransfer ? 100 : Math.max(percent, 8)}%`,
              }}
            />
          </div>
        </div>

        {/* ── State: Payment Confirmed OR Compact Payment Flow ── */}
        {isPaymentConfirmed ? (
          /* Payment Confirmed State */
          <div className="py-3 px-2 text-center animate-fade-in-up">
            <div className="w-10 h-10 mx-auto mb-1.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-lg font-black shadow-xs">
              ✓
            </div>
            <h3 className="text-sm font-black text-emerald-950">
              Payment Confirmed by {shopName}!
            </h3>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Collect your printout with Token <span className="font-mono font-bold text-zinc-950">{token.tokenCode}</span>
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onPrintAnother}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                Print Another Document
              </button>
            </div>
          </div>
        ) : (
          /* Unconfirmed / Split Compact Payment Section */
          <div className="space-y-2.5 pt-1">
            {/* Split Grid: Left = QR Code, Right = Method & Pay CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              
              {/* Left Column: QR Code (or Cash Badge) */}
              <div className="flex flex-col items-center justify-center bg-zinc-50/70 rounded-xl p-2.5 border border-zinc-100 text-center">
                {selectedMethod === "upi" ? (
                  <>
                    <div className="bg-white rounded-xl p-2 shadow-2xs border border-zinc-200/80">
                      <QRCodeSVG
                        value={upiUrl}
                        size={110}
                        level="M"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#111111"
                      />
                    </div>
                    <span className="text-[9px] font-bold text-zinc-500 mt-1.5 truncate max-w-[150px]">
                      UPI: {upiVpa}
                    </span>
                  </>
                ) : (
                  <div className="py-2 text-center">
                    <div className="w-10 h-10 mx-auto mb-1 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg shadow-2xs">
                      💵
                    </div>
                    <span className="text-xs font-bold text-zinc-900 block">
                      Pay Cash at Counter
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Hand ₹{totalAmount.toFixed(2)} to staff
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Method Selector + Primary Pay Button */}
              <div className="flex flex-col justify-center gap-2">
                {/* Method Selector Tabs */}
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-zinc-100 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("upi")}
                    className={`py-1 rounded-md transition-all text-center cursor-pointer ${
                      selectedMethod === "upi"
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    📱 UPI App
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("cash")}
                    className={`py-1 rounded-md transition-all text-center cursor-pointer ${
                      selectedMethod === "cash"
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    💵 Cash
                  </button>
                </div>

                {/* Primary Action Button */}
                {selectedMethod === "upi" ? (
                  <a
                    href={upiUrl}
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs tracking-tight text-center transition shadow-xs cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    <span>Tap to Pay in UPI App</span>
                    <span className="font-mono">(₹{totalAmount.toFixed(2)})</span>
                  </a>
                ) : (
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-900 text-[11px] font-semibold text-center border border-amber-200/60">
                    Staff will confirm payment on live terminal
                  </div>
                )}

                {/* Awaiting verification mini indicator */}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
                  <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
                    <span>Awaiting shop confirmation</span>
                  </div>
                  {onEditSettings && (
                    <button
                      type="button"
                      onClick={onEditSettings}
                      className="text-zinc-500 underline hover:text-zinc-800 cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
