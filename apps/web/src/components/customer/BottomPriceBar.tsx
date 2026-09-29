"use client";

import React, { useState } from "react";

interface BottomPriceBarProps {
  totalPrice: number;
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

  return (
    <>
      {/* Popover price breakdown */}
      {showBreakdown && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setShowBreakdown(false)}
        >
          <div
            className="absolute bottom-20 left-4 right-4 max-w-sm mx-auto bg-white rounded-2xl p-4 shadow-2xl border border-zinc-200 animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-900">Order Price Summary</span>
              <button
                type="button"
                onClick={() => setShowBreakdown(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-3 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Documents & Pages</span>
                <span className="font-semibold text-zinc-900">
                  {documentCount} file(s) • {totalSheets} sheet(s)
                </span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Color Mode</span>
                <span className="font-semibold text-zinc-900">
                  {colorMode === "color" ? "Full Color" : "Black & White"}
                </span>
              </div>
              {activeFinishingLabels.length > 0 && (
                <div className="pt-2 border-t border-zinc-100">
                  <span className="text-zinc-500 font-medium block mb-1">Add-on Services:</span>
                  {activeFinishingLabels.map((label, idx) => (
                    <div key={idx} className="flex justify-between text-zinc-600 pl-2">
                      <span>• {label}</span>
                      <span className="font-semibold text-zinc-900">Included</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-900">Total Payable</span>
              <span className="text-base font-extrabold text-emerald-600 font-mono">
                ₹{totalPrice}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="max-w-md mx-auto px-4 pb-4 pt-2 pointer-events-auto">
          <div
            className="rounded-2xl p-3.5 bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-2xl flex items-center justify-between gap-3 transition-all"
            style={{
              boxShadow: "0 -4px 25px -4px rgba(0, 0, 0, 0.08), 0 10px 30px rgba(0, 0, 0, 0.04)",
            }}
          >
            {/* Left: Price & Details button */}
            <div
              className="cursor-pointer select-none group min-w-0"
              onClick={() => setShowBreakdown((prev) => !prev)}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                  Total
                </span>
                <span className="text-xl font-extrabold text-emerald-600 font-mono tracking-tight group-hover:text-emerald-500 transition">
                  ₹{totalPrice}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 truncate">
                <span>
                  {totalSheets} sh • {colorMode === "color" ? "Color" : "B&W"}
                </span>
                {activeFinishingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-600 font-semibold text-[10px]">
                    +{activeFinishingCount} addon
                  </span>
                )}
                <span className="text-zinc-400 group-hover:text-zinc-600 transition text-[10px]">
                  {showBreakdown ? "▲" : "▼"} Details
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition active:scale-95"
                >
                  ← Back
                </button>
              )}

              <button
                type="button"
                onClick={onContinue}
                disabled={disabled}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md hover:shadow-lg transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{buttonLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
