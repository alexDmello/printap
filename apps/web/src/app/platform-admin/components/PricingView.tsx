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
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#2d2922]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c59e5e]" />
            <h2 className="text-lg font-bold text-[#f4ede4] tracking-tight">
              Global Platform Convenience Fee & GST Engine
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              料金 • SURCHARGE
            </span>
          </div>
          <p className="text-xs text-[#8a8174] mt-1">
            Configure the baseline network convenience fee and GST rate charged to customers per print session.
          </p>
        </div>

        {globalPricingMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-[#528364]/15 border border-[#528364]/30 text-xs font-mono text-[#73a886] flex items-center gap-2 animate-fade-in-up">
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
            <h3 className="text-sm font-bold text-[#f4ede4]">
              Platform Fee & Tax Structure Parameters
            </h3>
            <span className="text-[10px] font-mono text-[#736a5c]">
              Database Table: platform_settings
            </span>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Input 1: Platform Fee */}
            <div className="p-4 rounded-2xl bg-[#1f1d18] border border-[#2d2922] space-y-2">
              <label className="block text-xs font-semibold text-[#f4ede4]">
                Base Platform Fee (₹)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-[#8a8174]">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={globalPlatformFee}
                  onChange={(e) => handleGlobalFeeChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-[#26221b] border border-[#383227] text-sm text-[#f4ede4] font-mono font-bold focus:outline-none focus:border-[#c59e5e]"
                />
              </div>
              <span className="text-[10px] text-[#736a5c] block">
                Net fee retained by Printap platform per job
              </span>
            </div>

            {/* Input 2: GST Percentage */}
            <div className="p-4 rounded-2xl bg-[#1f1d18] border border-[#2d2922] space-y-2">
              <label className="block text-xs font-semibold text-[#f4ede4]">
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
                  className="w-full px-3 py-2 rounded-xl bg-[#26221b] border border-[#383227] text-sm text-[#f4ede4] font-mono font-bold focus:outline-none focus:border-[#c59e5e] text-center"
                />
                <span className="text-base font-bold font-mono text-[#8a8174]">%</span>
              </div>
              <span className="text-[10px] text-[#736a5c] block">
                Statutory indirect tax rate on platform fee
              </span>
            </div>

            {/* Auto-calc Box 1: Calculated GST */}
            <div className="p-4 rounded-2xl bg-[#26221b] border border-[#383227] flex flex-col justify-between">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#d96548]">
                Auto-Calculated GST
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#d96548] my-1">
                ₹{globalGstAmount.toFixed(2)}
              </div>
              <div className="text-[10px] text-[#736a5c]">
                {globalGstPercentage}% on ₹{globalPlatformFee.toFixed(2)}
              </div>
            </div>

            {/* Auto-calc Box 2: Total Customer Fee */}
            <div className="p-4 rounded-2xl bg-[#26221b] border border-[#383227] flex flex-col justify-between">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#528364]">
                Total Customer Surcharge
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#528364] my-1">
                ₹{globalTotalCharge.toFixed(2)}
              </div>
              <div className="text-[10px] text-[#736a5c]">
                ₹{globalPlatformFee.toFixed(2)} base + ₹{globalGstAmount.toFixed(2)} GST
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-[#26221c]">
            <div className="text-xs text-[#8a8174]">
              Customer pays: <strong className="text-[#f4ede4] font-mono">₹{globalTotalCharge.toFixed(2)}</strong> surcharge per session
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
                className="px-4 py-2.5 rounded-xl bg-[#25221b] hover:bg-[#322c22] text-[#c59e5e] border border-[#3d362b] text-xs font-semibold transition disabled:opacity-50"
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
              <h3 className="text-sm font-bold text-[#f4ede4]">
                Customer QR Checkout Simulation
              </h3>
              <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
                PREVIEW
              </span>
            </div>
            <p className="text-xs text-[#8a8174] mb-4">
              Live representation of how the surcharge appears to customers on mobile checkout screens.
            </p>

            {/* Simulated Receipt Bento */}
            <div className="p-4 rounded-2xl bg-[#151411] border border-[#2d2922] space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-[#8a8174]">
                <span>Document Printing (B&W)</span>
                <span className="text-[#f4ede4]">₹4.00</span>
              </div>
              <div className="flex justify-between items-center text-[#8a8174]">
                <span>Finishing Services</span>
                <span className="text-[#f4ede4]">₹0.00</span>
              </div>
              <div className="flex justify-between items-center text-[#c59e5e] pt-2 border-t border-[#26221c]">
                <span>Platform Convenience Fee</span>
                <span>₹{globalPlatformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[#d96548]">
                <span>Statutory GST ({globalGstPercentage}%)</span>
                <span>₹{globalGstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-[#f4ede4] pt-2.5 border-t border-[#332e25]">
                <span>Total Amount Due</span>
                <span className="text-[#528364]">
                  ₹{(4.0 + globalTotalCharge).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#26221c] text-[11px] text-[#736a5c] space-y-1">
            <div className="flex items-center gap-1.5">
              <IconShield size={12} className="text-[#528364]" />
              <span>Full GST invoicing compliance supported</span>
            </div>
            <p>Fee deducted automatically upon session token validation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
