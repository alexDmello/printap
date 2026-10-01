"use client";

import React, { useState } from "react";
import { PricingIcon, CheckCircleIcon, ExternalLinkIcon } from "./AdminIcons";

interface PricingEngineViewProps {
  globalPlatformFee: number;
  globalGstPercentage: number;
  globalGstAmount: number;
  globalTotalCharge: number;
  onFeeChange: (val: number) => void;
  onGstChange: (val: number) => void;
  onSavePricing: (applyToAll: boolean) => Promise<void>;
  isSaving: boolean;
  saveMsg: string;
}

export function PricingEngineView({
  globalPlatformFee,
  globalGstPercentage,
  globalGstAmount,
  globalTotalCharge,
  onFeeChange,
  onGstChange,
  onSavePricing,
  isSaving,
  saveMsg,
}: PricingEngineViewProps) {
  const [dailyVolumeEstimate, setDailyVolumeEstimate] = useState<number>(500);

  const monthlyVolume = dailyVolumeEstimate * 30;
  const monthlyGrossRevenue = monthlyVolume * globalTotalCharge;
  const monthlyNetRevenue = monthlyVolume * globalPlatformFee;
  const monthlyGstReserve = monthlyVolume * globalGstAmount;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Main Configuration Bento Card ─── */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 bento-card border border-white/90 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-black/[0.06] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[--color-foreground]">
                Global Convenience Fee & GST Engine
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Live Engine
              </span>
            </div>
            <p className="text-xs text-[--color-muted] mt-1 max-w-xl">
              Controls the network surcharge added to each customer print order. Rates are stored in
              the database (<code className="font-mono text-black font-semibold">platform_settings</code>) and synced to WebRTC signaling handlers.
            </p>
          </div>

          {saveMsg && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 animate-fade-in-up">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              <span>{saveMsg}</span>
            </div>
          )}
        </div>

        {/* ─── Inputs & Live Calculation Bento Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Input 1: Base Platform Fee */}
          <div className="p-4 rounded-2xl glass-panel-subtle border border-black/[0.06] space-y-2">
            <label className="block text-xs font-semibold text-[--color-foreground]">
              Base Platform Fee (₹)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[--color-muted]">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={globalPlatformFee}
                onChange={(e) => onFeeChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-base font-mono font-bold text-[--color-foreground] focus:outline-none focus:border-black shadow-sm"
              />
            </div>
            <span className="text-[10px] text-[--color-muted] block">
              Net platform take retained per session
            </span>
          </div>

          {/* Input 2: GST Rate Percentage */}
          <div className="p-4 rounded-2xl glass-panel-subtle border border-black/[0.06] space-y-2">
            <label className="block text-xs font-semibold text-[--color-foreground]">
              GST Rate Percentage (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={globalGstPercentage}
                onChange={(e) => onGstChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-base font-mono font-bold text-[--color-foreground] text-center focus:outline-none focus:border-black shadow-sm"
              />
              <span className="text-base font-bold text-[--color-muted]">%</span>
            </div>
            <span className="text-[10px] text-[--color-muted] block">
              Standard SAC 998313 printing GST rate
            </span>
          </div>

          {/* Auto-calc 1: GST Amount */}
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
              Auto-Calculated Tax
            </span>
            <div className="text-2xl font-black font-mono text-[--color-foreground] my-1">
              ₹{globalGstAmount.toFixed(2)}
            </div>
            <span className="text-[10px] text-[--color-muted]">
              {globalGstPercentage}% on ₹{globalPlatformFee.toFixed(2)} base fee
            </span>
          </div>

          {/* Auto-calc 2: Customer Total Surcharge */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Customer Total Surcharge
            </span>
            <div className="text-2xl font-black font-mono text-emerald-600 my-1">
              ₹{globalTotalCharge.toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-600/80">
              Total added to customer bill
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-black/[0.06] flex items-center justify-between flex-wrap gap-4">
          <div className="text-xs text-[--color-muted]">
            Customer invoice breakdown:{" "}
            <strong className="text-[--color-foreground]">₹{globalTotalCharge.toFixed(2)}</strong>{" "}
            (₹{globalPlatformFee.toFixed(2)} fee + ₹{globalGstAmount.toFixed(2)} GST)
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSavePricing(false)}
              disabled={isSaving}
              className="btn-primary px-5 py-2.5 rounded-2xl text-xs font-semibold text-white shadow-md transition"
            >
              {isSaving ? "Saving..." : "Save Global Settings"}
            </button>
            <button
              type="button"
              onClick={() => onSavePricing(true)}
              disabled={isSaving}
              className="glass-panel-subtle hover:bg-white px-4 py-2.5 rounded-2xl text-xs font-semibold text-indigo-600 border border-indigo-500/20 transition"
              title="Save to database and push new fee/GST values to all active shops"
            >
              Save & Apply to All Shops
            </button>
          </div>
        </div>
      </div>

      {/* ─── Bento Row 2: Customer Mock Preview & Financial Projections ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Customer Receipt Preview */}
        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[--color-foreground]">
              Customer Bill Experience Preview
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 text-[--color-muted]">
              Customer Touchpoint
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-black/10 shadow-sm space-y-3 font-sans">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Order Breakdown
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-gray-100">
              <span>Document Printing (4 pages B&W)</span>
              <span className="font-mono font-semibold">₹8.00</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-gray-100 text-indigo-600">
              <span>Platform Convenience Fee</span>
              <span className="font-mono font-semibold">₹{globalPlatformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-gray-100 text-indigo-600">
              <span>GST ({globalGstPercentage}%)</span>
              <span className="font-mono font-semibold">₹{globalGstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 text-black">
              <span>Grand Total (UPI QR)</span>
              <span className="font-mono">₹{(8.0 + globalTotalCharge).toFixed(2)}</span>
            </div>
          </div>

          <p className="text-[11px] text-[--color-muted]">
            Customers see transparent line items without hidden surcharges, ensuring maximum trust and 100% compliance.
          </p>
        </div>

        {/* Projected Platform Yield Bento */}
        <div className="glass-panel rounded-3xl p-6 bento-card border border-white/90 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[--color-foreground]">
                Projected Network Yield Simulator
              </h3>
              <span className="text-xs font-mono font-bold text-indigo-600">
                {dailyVolumeEstimate} prints/day
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={dailyVolumeEstimate}
              onChange={(e) => setDailyVolumeEstimate(Number(e.target.value))}
              className="w-full h-2 rounded-lg bg-black/10 appearance-none cursor-pointer accent-black mb-4"
            />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-black/[0.03]">
                <span className="text-[10px] text-[--color-muted] block">Monthly Prints</span>
                <span className="text-base font-black font-mono text-[--color-foreground]">
                  {monthlyVolume.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10">
                <span className="text-[10px] text-emerald-600 block">Monthly Net Take</span>
                <span className="text-base font-black font-mono text-emerald-600">
                  ₹{monthlyNetRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-500/5">
                <span className="text-[10px] text-indigo-500 block">Monthly GST Reserve</span>
                <span className="text-base font-black font-mono text-indigo-600">
                  ₹{monthlyGstReserve.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-500/5">
                <span className="text-[10px] text-purple-500 block">Gross Network Billing</span>
                <span className="text-base font-black font-mono text-purple-600">
                  ₹{monthlyGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[--color-muted]">
            Projections based on current ₹{globalTotalCharge.toFixed(2)} combined rate.
          </div>
        </div>
      </div>
    </div>
  );
}
