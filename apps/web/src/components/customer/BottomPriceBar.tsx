"use client";

import React, { useState } from "react";

interface BottomPriceBarProps {
  totalPrice: number;
  printingCost?: number;
  platformFee?: number;
  gstPercentage?: number;
  gstAmount?: number;
  totalCharge?: number;
  documentCount: number;
  totalSheets: number;
  colorMode: "bw" | "color";
  activeFinishingCount?: number;
  activeFinishingLabels?: string[];
  buttonLabel: string;
  onContinue: () => void;
  onBack?: () => void;
  disabled?: boolean;
}

export default function BottomPriceBar({
  totalPrice,
  printingCost,
  platformFee = 0,
  gstPercentage = 0,
  gstAmount = 0,
  totalCharge = 0,
  documentCount,
  totalSheets,
  colorMode,
  activeFinishingCount = 0,
  activeFinishingLabels = [],
  buttonLabel,
  onContinue,
  onBack,
  disabled = false,
}: BottomPriceBarProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const basePrintCost =
    printingCost !== undefined
      ? printingCost
      : totalPrice;

  return (
    <>
      {/* Popover price breakdown drawer */}
      {showBreakdown && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs transition-opacity"
          onClick={() => setShowBreakdown(false)}
        >
          <div
            className="fixed bottom-[68px] left-0 right-0 max-w-xl mx-auto px-4 sm:px-6 animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl p-5 shadow-2xl border border-zinc-200">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900">
                    Order Price Summary
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Instant Quote
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBreakdown(false)}
                  className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center text-xs font-bold transition"
                  aria-label="Close breakdown"
                >
                  ✕
                </button>
              </div>

              <div className="py-3.5 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <span>📄</span>
                    <span>Documents & Sheets</span>
                  </span>
                  <span className="font-semibold text-zinc-900">
                    {documentCount} file{documentCount !== 1 ? "s" : ""} •{" "}
                    {totalSheets} sheet{totalSheets !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <span>🎨</span>
                    <span>Print Color Mode</span>
                  </span>
                  <span className="font-semibold text-zinc-900">
                    {colorMode === "color" ? "Full Color" : "Black & White"}
                  </span>
                </div>
                {activeFinishingLabels.length > 0 && (
                  <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                    <span className="text-zinc-400 font-semibold uppercase text-[10px] tracking-wider block">
                      Finishing Services:
                    </span>
                    {activeFinishingLabels.map((label, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-zinc-600 pl-2"
                      >
                        <span>• {label}</span>
                        <span className="font-semibold text-zinc-900">
                          Included
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-zinc-600">
                  <span>Printing Charges</span>
                  <span className="font-semibold font-mono text-zinc-900">
                    ₹{basePrintCost.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-900">
                  Total Payable
                </span>
                <span className="text-xl font-extrabold text-emerald-600 font-mono">
                  ₹{totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Docked, Flush Edge-to-Edge Bottom Navigation Bar (NOT floating!) */}
      <nav
        aria-label="Bottom Checkout Actions"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-t border-zinc-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Left: Total on top, Cost below, with dotted underline to view details */}
          <button
            type="button"
            onClick={() => setShowBreakdown((prev) => !prev)}
            className="text-left group select-none min-w-0 flex items-center hover:opacity-90 transition cursor-pointer"
            title="Click to view price details and GST breakdown"
          >
            <div className="border-b border-dotted border-zinc-400 group-hover:border-zinc-700 pb-0.5 transition inline-flex flex-col">
              <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase leading-none">
                TO PAY
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono tracking-tight leading-tight mt-0.5">
                ₹{totalPrice.toFixed(2)}
              </span>
            </div>
          </button>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] transition cursor-pointer"
              >
                ← Back
              </button>
            )}

            <button
              type="button"
              onClick={onContinue}
              disabled={disabled}
              className="btn-primary px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md active:scale-[0.98] transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{buttonLabel}</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
