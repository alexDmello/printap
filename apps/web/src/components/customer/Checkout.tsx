"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PaymentMethod } from "@printap/shared";

interface CheckoutProps {
  shopName: string;
  shopId: string;
  upiVpa: string;
  totalAmount: number;
  onPaymentConfirmed: (method: PaymentMethod) => void;
  onBack: () => void;
}

export default function Checkout({
  shopName,
  shopId,
  upiVpa,
  totalAmount,
  onPaymentConfirmed,
  onBack,
}: CheckoutProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("upi");
  const [cashWaiting, setCashWaiting] = useState(false);
  const [cashPulse, setCashPulse] = useState(0);

  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(
    shopName
  )}&am=${totalAmount.toFixed(2)}&cu=INR&tn=Printap-${shopId.slice(0, 8)}`;

  // Simulate cash confirmation pulse animation
  useEffect(() => {
    if (!cashWaiting) return;
    const interval = setInterval(() => {
      setCashPulse((p) => (p + 1) % 4);
    }, 600);
    return () => clearInterval(interval);
  }, [cashWaiting]);

  const handleCashRequest = useCallback(() => {
    setCashWaiting(true);
    // In production, this would listen for a Supabase Realtime event
    // from the shopkeeper's desktop app confirming cash receipt
  }, []);

  return (
    <div className="animate-fade-in-up space-y-4">
      {/* Amount card */}
      <div className="glass rounded-2xl p-5 glow-sm text-center">
        <p className="text-sm text-[--color-muted] mb-1">Amount to Pay</p>
        <p className="text-3xl font-bold text-[--color-success]">₹{totalAmount}</p>
        <p className="text-[11px] text-[--color-muted] mt-1">to {shopName}</p>
      </div>

      {/* Payment method selector */}
      {!cashWaiting && (
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedMethod("upi")}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${
              selectedMethod === "upi"
                ? "border-[--color-accent] bg-[--color-accent]/10 text-[--color-accent-light]"
                : "border-[--color-border] bg-[--color-surface-light] text-[--color-muted]"
            }`}
          >
            <span className="block text-lg mb-1">📱</span>
            UPI / QR
          </button>
          <button
            onClick={() => setSelectedMethod("cash")}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${
              selectedMethod === "cash"
                ? "border-[--color-accent] bg-[--color-accent]/10 text-[--color-accent-light]"
                : "border-[--color-border] bg-[--color-surface-light] text-[--color-muted]"
            }`}
          >
            <span className="block text-lg mb-1">💵</span>
            Cash
          </button>
        </div>
      )}

      {/* UPI Payment */}
      {selectedMethod === "upi" && !cashWaiting && (
        <div className="glass rounded-2xl p-5 glow-sm">
          <p className="text-sm font-medium mb-4 text-center">
            Scan to pay via UPI
          </p>
          <div className="bg-white rounded-xl p-3 mx-auto w-fit">
            <QRCodeSVG
              value={upiUrl}
              size={180}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#111111"
            />
          </div>
          <p className="text-[11px] text-[--color-muted] text-center mt-3">
            Pay to{" "}
            <span className="font-mono text-[--color-foreground]/70">
              {upiVpa}
            </span>
          </p>

          {/* UPI Intent deep link (mobile) */}
          <a
            href={upiUrl}
            className="block mt-4 btn-primary w-full py-3 rounded-xl font-semibold text-white text-sm tracking-wide text-center"
          >
            Open UPI App to Pay ₹{totalAmount}
          </a>

          <button
            onClick={() => onPaymentConfirmed("upi")}
            className="block w-full mt-3 py-3 rounded-xl bg-[--color-surface-light] hover:bg-[--color-border] text-sm font-medium text-center transition-all"
          >
            I&apos;ve Paid — Send to Printer →
          </button>
        </div>
      )}

      {/* Cash at Counter */}
      {selectedMethod === "cash" && !cashWaiting && (
        <div className="glass rounded-2xl p-5 glow-sm text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
            <span className="text-3xl">💵</span>
          </div>
          <h3 className="text-base font-semibold mb-2">Pay Cash at Counter</h3>
          <p className="text-sm text-[--color-muted] mb-5">
            Hand <span className="font-bold text-[--color-foreground]">₹{totalAmount}</span> to
            the counter operator and they'll confirm receipt on their terminal.
          </p>
          <button
            onClick={handleCashRequest}
            className="btn-primary w-full py-3.5 rounded-xl font-semibold text-white text-sm tracking-wide"
          >
            I&apos;m Paying Cash — Notify Counter
          </button>
        </div>
      )}

      {/* Cash Waiting State */}
      {cashWaiting && (
        <div className="glass rounded-2xl p-8 glow-sm text-center animate-pulse-glow">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div
              className="absolute inset-0 rounded-full border-2 border-amber-400/30 transition-all"
              style={{
                transform: `scale(${1 + cashPulse * 0.1})`,
                opacity: 1 - cashPulse * 0.2,
              }}
            />
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="text-3xl">🤝</span>
            </div>
          </div>
          <h3 className="text-base font-semibold text-amber-400 mb-2">
            Awaiting Counter Verification
          </h3>
          <p className="text-sm text-[--color-muted]">
            Hand <span className="font-bold text-amber-300">₹{totalAmount}</span> to
            the counter operator.
          </p>
          <p className="text-xs text-[--color-muted] mt-3 animate-pulse">
            Waiting for the shopkeeper to confirm
            {".".repeat((cashPulse % 3) + 1)}
          </p>

          {/* TODO: In production, listen for Supabase Realtime event.
              For now, provide a manual confirm button for testing. */}
          <button
            onClick={() => onPaymentConfirmed("cash")}
            className="mt-6 px-6 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium transition-all"
          >
            [Dev] Simulate Cash Confirmation
          </button>
        </div>
      )}

      {/* Back button */}
      {!cashWaiting && (
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-[--color-surface-light] hover:bg-[--color-border] text-sm font-medium transition-all"
        >
          ← Back to Settings
        </button>
      )}
    </div>
  );
}
