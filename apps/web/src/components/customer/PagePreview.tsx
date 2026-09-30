"use client";

import React, { useState } from "react";
import type {
  UploadedDocument,
  ShopRateCard,
  FinishingService,
} from "@printap/shared";

interface PagePreviewProps {
  documents: UploadedDocument[];
  rateCard: ShopRateCard;
  finishingServices: FinishingService[];
  onBack: () => void;
  onContinue: () => void;
}

export default function PagePreview({
  documents,
  rateCard,
  finishingServices,
  onBack,
  onContinue,
}: PagePreviewProps) {
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const doc = documents[selectedDocIndex] || documents[0];
  if (!doc) return null;

  const { settings, pageCount, file, thumbnailUrl } = doc;
  const isLandscape = settings.orientation === "landscape";
  const isBw = settings.colorMode === "bw";
  const activeAddons = finishingServices.filter((s) => s.enabled);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ── Header ── */}
      <div className="glass rounded-2xl p-5 glow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Document Print Preview</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Live visual simulation of your printed sheet based on selected settings
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition"
          >
            ⚙ Edit Settings
          </button>
        </div>

        {/* Multi-document switcher */}
        {documents.length > 1 && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100 overflow-x-auto pb-1">
            {documents.map((d, idx) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setSelectedDocIndex(idx);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedDocIndex === idx
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                }`}
              >
                File {idx + 1}: {d.file.name.slice(0, 16)}...
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Realistic Sheet Preview Canvas ── */}
      <div className="glass rounded-2xl p-5 glow-sm text-center">
        {/* Active badges bar */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isBw
                ? "bg-zinc-100 text-zinc-800 border-zinc-300"
                : "bg-gradient-to-r from-indigo-50 to-pink-50 text-indigo-700 border-indigo-200"
            }`}
          >
            {isBw ? "⚫ Monochrome (B&W)" : "🎨 Full Color"}
          </span>

          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
            {isLandscape ? "▭ Landscape" : "▯ Portrait"}
          </span>

          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
            {settings.duplex === "double" ? "2-Sided (Duplex)" : "1-Sided (Simplex)"}
          </span>

          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
            {settings.pagesPerSheet}-in-1 Layout
          </span>
        </div>

        {/* Paper Sheet Viewport */}
        <div className="w-full flex items-center justify-center py-4 bg-zinc-100/60 rounded-xl border border-zinc-200/60 overflow-hidden">
          <div
            className={`relative bg-white rounded-lg border border-zinc-300 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xl ${
              isLandscape
                ? "w-[280px] h-[198px]"
                : "w-[200px] h-[282px]"
            }`}
            style={{
              filter: isBw ? "grayscale(100%) contrast(1.15) brightness(0.96)" : "none",
            }}
          >
            {/* Paper Corner fold accent */}
            <div className="absolute top-0 right-0 w-4 h-4 bg-zinc-100 border-b border-l border-zinc-300 rounded-bl-sm pointer-events-none" />

            {/* Layout rendering */}
            <div className="w-full h-full p-3 flex flex-col justify-between">
              {/* 1-in-1 layout */}
              {settings.pagesPerSheet === 1 && (
                <div className="w-full h-full border border-dashed border-zinc-200 rounded p-2 flex flex-col justify-between bg-zinc-50/40">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200/80">
                    <span className="text-[8px] font-bold text-zinc-600 truncate max-w-[120px]">
                      {file.name}
                    </span>
                    <span className="text-[8px] font-mono text-zinc-400">
                      Pg {currentPage}
                    </span>
                  </div>

                  {thumbnailUrl ? (
                    <div className="flex-1 my-1 overflow-hidden rounded flex items-center justify-center bg-white">
                      <img
                        src={thumbnailUrl}
                        alt="Document Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 my-1 flex flex-col justify-center space-y-1.5 px-1 opacity-70">
                      <div className="h-1.5 w-3/4 bg-zinc-400 rounded-full" />
                      <div className="h-1.5 w-full bg-zinc-300 rounded-full" />
                      <div className="h-1.5 w-5/6 bg-zinc-300 rounded-full" />
                      <div className="h-1.5 w-full bg-zinc-300 rounded-full" />
                      <div className="h-1.5 w-4/5 bg-zinc-300 rounded-full" />
                      <div className="h-1.5 w-2/3 bg-zinc-300 rounded-full" />
                    </div>
                  )}

                  <div className="pt-1 border-t border-zinc-200/60 flex justify-between text-[7px] text-zinc-400">
                    <span>A4 Standard Paper</span>
                    <span>Printap Safe Spool</span>
                  </div>
                </div>
              )}

              {/* 2-in-1 layout */}
              {settings.pagesPerSheet === 2 && (
                <div className="w-full h-full grid grid-cols-2 gap-2">
                  {[currentPage, Math.min(pageCount, currentPage + 1)].map((pNum, i) => (
                    <div
                      key={i}
                      className="border border-dashed border-zinc-200 rounded p-1.5 flex flex-col justify-between bg-zinc-50/40"
                    >
                      <span className="text-[7px] font-mono text-zinc-400">Pg {pNum}</span>
                      <div className="space-y-1 opacity-70 my-auto">
                        <div className="h-1 w-full bg-zinc-300 rounded" />
                        <div className="h-1 w-3/4 bg-zinc-300 rounded" />
                        <div className="h-1 w-5/6 bg-zinc-300 rounded" />
                      </div>
                      <span className="text-[6px] text-zinc-300">2-in-1</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 4-in-1 layout */}
              {settings.pagesPerSheet === 4 && (
                <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1.5">
                  {[0, 1, 2, 3].map((offset) => {
                    const pNum = Math.min(pageCount, currentPage + offset);
                    return (
                      <div
                        key={offset}
                        className="border border-dashed border-zinc-200 rounded p-1 flex flex-col justify-between bg-zinc-50/40"
                      >
                        <span className="text-[6px] font-mono text-zinc-400">Pg {pNum}</span>
                        <div className="space-y-0.5 opacity-60 my-auto">
                          <div className="h-0.5 w-full bg-zinc-300 rounded" />
                          <div className="h-0.5 w-3/4 bg-zinc-300 rounded" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Switcher Navigation */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>

            <span className="text-xs font-mono font-bold text-zinc-700">
              Page {currentPage} of {pageCount}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage >= pageCount}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Order Specs Breakdown Card ── */}
      <div className="glass rounded-2xl p-5 glow-sm space-y-3">
        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
          Job Summary
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Document</span>
            <span className="font-semibold text-zinc-900 truncate max-w-[200px]">
              {file.name}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Copies to Print</span>
            <span className="font-bold text-zinc-900 font-mono">
              {settings.copies} {settings.copies === 1 ? "copy" : "copies"}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Print Style</span>
            <span className="font-semibold text-zinc-900">
              {isBw ? `B&W @ ₹${rateCard.priceBwPerPage}/page` : `Color @ ₹${rateCard.priceColorPerPage}/page`}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Paper Duplex</span>
            <span className="font-semibold text-zinc-900">
              {settings.duplex === "double" ? "Double-sided (Duplex)" : "Single-sided"}
            </span>
          </div>

          {activeAddons.length > 0 && (
            <div className="pt-2">
              <span className="text-zinc-500 block mb-1.5 font-medium">Selected Add-ons:</span>
              {activeAddons.map((addon) => (
                <div key={addon.type} className="flex justify-between text-zinc-700 pl-2 py-0.5">
                  <span>• {addon.label}</span>
                  <span className="font-mono font-bold text-zinc-900">+₹{addon.price}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
