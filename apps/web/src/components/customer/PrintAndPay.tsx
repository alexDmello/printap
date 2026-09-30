"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { UploadedDocument, QueueToken, PaymentMethod } from "@printap/shared";
import type { TransferProgress } from "@/lib/customer-signaling";

interface PrintAndPayProps {
  shopName: string;
  shopId: string;
  upiVpa: string;
  totalAmount: number;
  documents: UploadedDocument[];
  token: QueueToken;
  progress: TransferProgress | null;
  isPaymentConfirmed: boolean;
  onPrintAnother: () => void;
}

export default function PrintAndPay({
  shopName,
  shopId,
  upiVpa,
  totalAmount,
  documents,
  token,
  progress,
  isPaymentConfirmed,
  onPrintAnother,
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
  const isCompleteTransfer = progress && progress.status === "complete";
  const percent = progress?.percent ?? 0;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ─── Token Identity Hero Card ─── */}
      <div className="glass rounded-2xl p-5 border border-zinc-200/80 shadow-sm text-center relative overflow-hidden bg-white/80">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            Your Counter Token
          </span>
          <button
            type="button"
            onClick={handleCopyToken}
            className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-md transition cursor-pointer"
          >
            {copiedToken ? "Copied ✓" : "Copy Token"}
          </button>
        </div>

        <div className="flex items-center justify-center my-1">
          <div className="text-4xl sm:text-5xl font-black text-zinc-900 font-mono tracking-tight bg-zinc-100 px-6 py-2 rounded-xl border border-zinc-200 shadow-inner">
            {token.tokenCode}
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-2.5">
          Show this Token at <span className="font-semibold text-zinc-800">{shopName}</span> when collecting your paper.
        </p>
      </div>

      {/* ─── Automatic Printing & Spool Progress Card ─── */}
      <div className="glass rounded-2xl p-4 sm:p-5 border border-zinc-200/80 shadow-xs bg-white/70">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isCompleteTransfer ? "bg-emerald-500 animate-pulse" : "bg-indigo-600 animate-ping"
            }`} />
            <span className="text-xs font-bold text-zinc-900">
              {isCompleteTransfer
                ? "Document Spooled — Printing in Progress"
                : isTransferring
                ? "Streaming Directly to Hardware Printer..."
                : "Connecting to Counter Terminal..."}
            </span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-zinc-600">
            {documents.length} {documents.length === 1 ? "file" : "files"}
          </span>
        </div>

        {/* Progress track */}
        <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200/80 my-2">
          <div
            className="bg-zinc-900 h-full transition-all duration-300 rounded-full"
            style={{ width: `${isCompleteTransfer ? 100 : Math.max(percent, 8)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-zinc-500 mt-1">
          <span className="truncate max-w-[240px]">
            {progress?.currentFileName || documents[0]?.file.name}
          </span>
          <span className="font-mono font-semibold">
            {isCompleteTransfer ? "100% Spooled" : `${percent}%`}
          </span>
        </div>

        <p className="text-[11px] text-zinc-500 mt-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
          ⚡ Your document goes directly to the counter printer over peer-to-peer Wi-Fi. No waiting in long print queues.
        </p>
      </div>

      {/* ─── Shop Confirmation & Handover Banner ─── */}
      {isPaymentConfirmed ? (
        <div className="glass rounded-2xl p-6 border-2 border-emerald-500 bg-emerald-50/90 shadow-md text-center animate-fade-in-up">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl font-black shadow-sm">
            ✓
          </div>
          <h2 className="text-lg font-black text-emerald-950">
            Payment Confirmed by Shop!
          </h2>
          <p className="text-xs text-emerald-800 mt-1 max-w-sm mx-auto">
            The counter operator at <span className="font-bold">{shopName}</span> has verified your payment of ₹{totalAmount.toFixed(2)}.
          </p>

          <div className="mt-4 p-3 bg-white/90 rounded-xl border border-emerald-200 inline-block text-xs font-semibold text-zinc-800">
            👉 Please collect your printout with Token <span className="font-mono font-bold text-zinc-950">{token.tokenCode}</span>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={onPrintAnother}
              className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white shadow transition cursor-pointer"
            >
              Print Another Document
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-4 border border-amber-300 bg-amber-50/80 shadow-xs text-center">
          <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
            <span>Awaiting Counter Payment Verification</span>
          </div>
          <p className="text-[11px] text-amber-800 mt-1">
            Complete your payment below. The shop admin will confirm receipt on their live terminal and hand over your printout.
          </p>
        </div>
      )}

      {/* ─── Payment Options (Active while unconfirmed) ─── */}
      {!isPaymentConfirmed && (
        <div className="glass rounded-2xl p-5 border border-zinc-200/80 shadow-xs bg-white/80 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Total Amount Due
              </span>
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono">
                ₹{totalAmount.toFixed(2)}
              </span>
            </div>

            {/* Method Tabs */}
            <div className="flex gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedMethod("upi")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
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
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedMethod === "cash"
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                💵 Cash
              </button>
            </div>
          </div>

          {/* UPI Method */}
          {selectedMethod === "upi" && (
            <div className="text-center pt-2">
              <p className="text-xs font-bold text-zinc-800 mb-3">
                Scan with any UPI App (GPay / PhonePe / Paytm / BHIM)
              </p>

              <div className="bg-white rounded-2xl p-3.5 mx-auto w-fit shadow-xs border border-zinc-200">
                <QRCodeSVG
                  value={upiUrl}
                  size={170}
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
                className="mt-3 inline-block w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs tracking-wide text-center transition shadow-xs"
              >
                Tap to Open in UPI App (₹{totalAmount.toFixed(2)})
              </a>
            </div>
          )}

          {/* Cash Method */}
          {selectedMethod === "cash" && (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xl">
                💵
              </div>
              <h3 className="text-sm font-bold text-zinc-900">
                Pay Cash Directly at the Counter
              </h3>
              <p className="text-xs text-zinc-600 mt-1 max-w-xs mx-auto">
                Hand <span className="font-bold text-zinc-900 font-mono">₹{totalAmount.toFixed(2)}</span> to the shop staff. They will click "Confirm Payment" on the live terminal to hand over your printout.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
