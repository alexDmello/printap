"use client";

import React from "react";
import { IconCoins, IconCheck, IconShield } from "./Icons";

interface PricingViewProps {
  globalPlatformFee: number;
  globalGstPercentage: number;
  globalGstAmount: number;
  globalTotalCharge: number;
  handleGlobalFeeChange: (val: number) => void;
  handleGlobalGstChange: (val: number) => void;
  handleSaveGlobalPricing: (applyToAllShops?: boolean) => void;
  isSavingGlobalPricing: boolean;
  globalPricingMsg: string;
}

export function PricingView({
  globalPlatformFee,
  globalGstPercentage,
  globalGstAmount,
  globalTotalCharge,
  handleGlobalFeeChange,
  handleGlobalGstChange,
  handleSaveGlobalPricing,
  isSavingGlobalPricing,
  globalPricingMsg,
}: PricingViewProps) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#222226]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Global Platform Convenience Fee & GST Engine
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              料金 • SURCHARGE
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Configure the baseline network convenience fee and GST rate charged to customers per print session.
          </p>
        </div>

        {globalPricingMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-mono text-white flex items-center gap-2 animate-fade-in-up">
            <IconCheck size={13} />
            <span>{globalPricingMsg}</span>
          </div>
        )}
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bento: Config Inputs & Auto-Calculated Cards (Span 2) */}
        <div className="lg:col-span-2 wabi-bento-card rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              Platform Fee & Tax Structure Parameters
            </h3>
            <span className="text-[10px] font-mono text-zinc-400">
              Database: platform_settings
            </span>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Input 1: Platform Fee */}
            <div className="p-4 rounded-2xl bg-[#18181b] border border-[#27272a] space-y-2">
              <label className="block text-xs font-semibold text-white">
                Base Platform Fee (₹)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-zinc-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={globalPlatformFee}
                  onChange={(e) => handleGlobalFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-[#202024] border border-[#2d2d32] text-sm text-white font-mono font-bold focus:outline-none focus:border-white"
                />
              </div>
              <span className="text-[10px] text-zinc-400 block">
                Net fee retained by Printap platform per job
              </span>
            </div>

            {/* Input 2: GST Percentage */}
            <div className="p-4 rounded-2xl bg-[#18181b] border border-[#27272a] space-y-2">
              <label className="block text-xs font-semibold text-white">
                Statutory GST Percentage (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={globalGstPercentage}
                  onChange={(e) => handleGlobalGstChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-[#202024] border border-[#2d2d32] text-sm text-white font-mono font-bold focus:outline-none focus:border-white text-center"
                />
                <span className="text-base font-bold font-mono text-zinc-400">%</span>
              </div>
              <span className="text-[10px] text-zinc-400 block">
                Statutory indirect tax rate on platform fee
              </span>
            </div>

            {/* Auto-calc Box 1: Calculated GST */}
            <div className="p-4 rounded-2xl bg-[#18181b] border border-[#27272a] flex flex-col justify-between">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                Auto-Calculated GST
              </div>
              <div className="text-3xl font-extrabold font-mono text-zinc-300 my-1">
                ₹{globalGstAmount.toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-400">
                {globalGstPercentage}% on ₹{globalPlatformFee.toFixed(2)}
              </div>
            </div>

            {/* Auto-calc Box 2: Total Customer Fee */}
            <div className="p-4 rounded-2xl bg-[#18181b] border border-white/20 flex flex-col justify-between shadow-sm">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-white">
                Total Customer Surcharge
              </div>
              <div className="text-3xl font-extrabold font-mono text-white my-1">
                ₹{globalTotalCharge.toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-400">
                ₹{globalPlatformFee.toFixed(2)} base + ₹{globalGstAmount.toFixed(2)} GST
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-[#1f1f23]">
            <div className="text-xs text-zinc-400">
              Customer pays: <strong className="text-white font-mono">₹{globalTotalCharge.toFixed(2)}</strong> surcharge per session
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveGlobalPricing(false)}
                disabled={isSavingGlobalPricing}
                className="wabi-btn-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <span>{isSavingGlobalPricing ? "Saving..." : "Save Global Settings"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveGlobalPricing(true)}
                disabled={isSavingGlobalPricing}
                className="px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-zinc-200 hover:text-white border border-[#2a2a2e] text-xs font-semibold transition disabled:opacity-50"
                title="Update global platform_settings and cascade values across all registered shops"
              >
                Save & Propagate to All Shops
              </button>
            </div>
          </div>
        </div>

        {/* Side Bento: Customer Checkout Simulation Card (Span 1) */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">
                Customer QR Checkout Simulation
              </h3>
              <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
                PREVIEW
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Live representation of how the surcharge appears to customers on mobile checkout screens.
            </p>

            {/* Simulated Receipt Bento */}
            <div className="p-4 rounded-2xl bg-[#0a0a0c] border border-[#222226] space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Document Printing (B&W)</span>
                <span className="text-white">₹4.00</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Finishing Services</span>
                <span className="text-white">₹0.00</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300 pt-2 border-t border-[#1f1f23]">
                <span>Platform Convenience Fee</span>
                <span>₹{globalPlatformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Statutory GST ({globalGstPercentage}%)</span>
                <span>₹{globalGstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-white pt-2.5 border-t border-[#2a2a2e]">
                <span>Total Amount Due</span>
                <span className="text-white">
                  ₹{(4.0 + globalTotalCharge).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#1f1f23] text-[11px] text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5">
              <IconShield size={12} className="text-white" />
              <span>Full GST invoicing compliance supported</span>
            </div>
            <p>Fee deducted automatically upon session token validation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
