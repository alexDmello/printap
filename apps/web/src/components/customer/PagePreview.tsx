"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  // Separate non-image documents (e.g. PDFs) and image documents
  const pdfDocs = useMemo(
    () => documents.filter((d) => d.type !== "image"),
    [documents]
  );
  const imageDocs = useMemo(
    () => documents.filter((d) => d.type === "image"),
    [documents]
  );

  // Define tabs: each PDF document + (if any images exist) one unified Images Batch tab
  interface PreviewTab {
    id: string;
    type: "pdf" | "image_batch";
    title: string;
    doc?: UploadedDocument;
  }

  const tabs = useMemo<PreviewTab[]>(() => {
    const list: PreviewTab[] = [];
    pdfDocs.forEach((d, idx) => {
      list.push({
        id: d.id,
        type: "pdf",
        title: d.file.name,
        doc: d,
      });
    });
    if (imageDocs.length > 0) {
      list.push({
        id: "images-batch",
        type: "image_batch",
        title: `Photos & Images (${imageDocs.length})`,
      });
    }
    return list;
  }, [pdfDocs, imageDocs]);

  const [activeTabId, setActiveTabId] = useState<string>(
    tabs[0]?.id || ""
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSheet, setCurrentSheet] = useState(1);

  // Sync tab if tabs change
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTabId) && tabs.length > 0) {
      setActiveTabId(tabs[0].id);
      setCurrentPage(1);
      setCurrentSheet(1);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  if (!activeTab) return null;

  const isImageBatch = activeTab.type === "image_batch";

  // Common settings for the active view
  const activeSettings = isImageBatch
    ? imageDocs[0]?.settings
    : activeTab.doc?.settings;

  const isLandscape = activeSettings?.orientation === "landscape";
  const isBw = activeSettings?.colorMode === "bw";
  const gridLayout = activeSettings?.pagesPerSheet || 1;

  // Image batch pagination calculation
  const totalImageSheets = useMemo(() => {
    if (!isImageBatch || imageDocs.length === 0) return 1;
    return Math.ceil(imageDocs.length / gridLayout);
  }, [isImageBatch, imageDocs.length, gridLayout]);

  const currentSheetPhotos = useMemo(() => {
    if (!isImageBatch) return [];
    const startIndex = (currentSheet - 1) * gridLayout;
    return imageDocs.slice(startIndex, startIndex + gridLayout);
  }, [isImageBatch, imageDocs, currentSheet, gridLayout]);

  // Object URL for PDF native viewer (cleaned up on unmount/change)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImageBatch && activeTab.doc?.file) {
      const url = URL.createObjectURL(activeTab.doc.file);
      setPdfBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPdfBlobUrl(null);
    }
  }, [isImageBatch, activeTab.doc?.file]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ── Header ── */}
      <div className="glass rounded-2xl p-5 glow-sm">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Printed Sheet Preview</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Exact visual simulation of how your document will physically emerge from the printer
          </p>
        </div>

        {/* Multi-Document / Images Switcher Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100 overflow-x-auto pb-1 scrollbar-thin">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTabId(tab.id);
                  setCurrentPage(1);
                  setCurrentSheet(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTabId === tab.id
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"
                }`}
              >
                <span>{tab.type === "image_batch" ? "🖼️" : "📄"}</span>
                <span className="truncate max-w-[160px]">{tab.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Authentic Paper Canvas Viewport ── */}
      <div className="glass rounded-2xl p-5 sm:p-6 glow-sm text-center">
        {/* Active badges bar */}
        <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
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
            {activeSettings?.duplex === "double" ? "2-Sided (Duplex)" : "1-Sided"}
          </span>

          {isImageBatch && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {gridLayout}-in-1 Photo Grid
            </span>
          )}
        </div>

        {/* Paper Sheet Viewport (Strict A4 Aspect Ratio: 1 : 1.414 or 1.414 : 1) */}
        <div className="w-full flex items-center justify-center py-6 bg-zinc-200/50 rounded-2xl border border-zinc-300/60 overflow-hidden shadow-inner">
          <div
            className={`relative bg-white transition-all duration-300 overflow-hidden flex flex-col ${
              isLandscape
                ? "w-[336px] sm:w-[476px] h-[238px] sm:h-[336px]"
                : "w-[238px] sm:w-[336px] h-[336px] sm:h-[476px]"
            }`}
            style={{
              boxShadow:
                "0 20px 35px -10px rgba(0, 0, 0, 0.25), 0 5px 12px -2px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.3)",
              filter: isBw
                ? "grayscale(100%) contrast(1.15) brightness(0.97)"
                : "none",
            }}
          >
            {/* Authentic Printable Margins (p-3 sm:p-4) with ZERO artificial mock text! */}
            <div className="w-full h-full p-2.5 sm:p-4 flex items-center justify-center">
              {/* ──────────────────────────────────────────────────
                  A. IMAGE BATCH: Render actual photos in grid
                  (1in1, 2in1, 4in1, 6in1, 9in1)
              ────────────────────────────────────────────────── */}
              {isImageBatch && (
                <div className="w-full h-full flex items-center justify-center">
                  {/* 1-in-1: Single photo centered on the sheet */}
                  {gridLayout === 1 && currentSheetPhotos[0] && (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                      <img
                        src={currentSheetPhotos[0].thumbnailUrl}
                        alt="Photo Preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}

                  {/* 2-in-1: 2 photos on paper */}
                  {gridLayout === 2 && (
                    <div
                      className={`w-full h-full grid gap-2 ${
                        isLandscape ? "grid-cols-2" : "grid-rows-2"
                      }`}
                    >
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 4-in-1: 2x2 grid */}
                  {gridLayout === 4 && (
                    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2">
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 6-in-1: 2x3 or 3x2 grid */}
                  {gridLayout === 6 && (
                    <div
                      className={`w-full h-full grid gap-1.5 ${
                        isLandscape
                          ? "grid-cols-3 grid-rows-2"
                          : "grid-cols-2 grid-rows-3"
                      }`}
                    >
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 9-in-1: 3x3 grid */}
                  {gridLayout === 9 && (
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-1">
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────────────────────────────────────────
                  B. PDF DOCUMENT: Render actual document content
              ────────────────────────────────────────────────── */}
              {!isImageBatch && activeTab.doc && (
                <div className="w-full h-full flex items-center justify-center overflow-hidden bg-white">
                  {pdfBlobUrl ? (
                    <iframe
                      src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                      className="w-full h-full border-0 pointer-events-none"
                      title="PDF Document Page"
                    />
                  ) : activeTab.doc.thumbnailUrl ? (
                    <img
                      src={activeTab.doc.thumbnailUrl}
                      alt="Document Page"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full border border-zinc-200 flex items-center justify-center text-zinc-400 text-xs">
                      Loading page preview...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sheet / Page Switcher Navigation (Outside the Paper Area) ── */}
        {isImageBatch && totalImageSheets > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setCurrentSheet((s) => Math.max(1, s - 1))}
              disabled={currentSheet <= 1}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              ← Prev Sheet
            </button>

            <span className="text-xs font-mono font-bold text-zinc-800">
              Sheet {currentSheet} of {totalImageSheets}
            </span>

            <button
              type="button"
              onClick={() => setCurrentSheet((s) => Math.min(totalImageSheets, s + 1))}
              disabled={currentSheet >= totalImageSheets}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next Sheet →
            </button>
          </div>
        )}

        {!isImageBatch && (activeTab.doc?.pageCount || 1) > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              ← Prev Page
            </button>

            <span className="text-xs font-mono font-bold text-zinc-800">
              Page {currentPage} of {activeTab.doc?.pageCount || 1}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) =>
                  Math.min(activeTab.doc?.pageCount || 1, p + 1)
                )
              }
              disabled={currentPage >= (activeTab.doc?.pageCount || 1)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next Page →
            </button>
          </div>
        )}
      </div>

      {/* ── Order Specs Summary Card ── */}
      <div className="glass rounded-2xl p-5 glow-sm space-y-3">
        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
          Job Specifications
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Document Selection</span>
            <span className="font-semibold text-zinc-900 truncate max-w-[220px]">
              {isImageBatch ? `Photos & Images (${imageDocs.length} photos)` : activeTab.title}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Grid / Layout</span>
            <span className="font-semibold text-zinc-900">
              {isImageBatch
                ? `${gridLayout}-in-1 Photo Grid`
                : `${activeSettings?.pagesPerSheet || 1}-in-1 Page Layout`}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Sets / Copies</span>
            <span className="font-mono font-bold text-zinc-900">
              {activeSettings?.copies || 1}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Color Reproduction</span>
            <span className="font-semibold text-zinc-900 capitalize">
              {isBw ? "Black & White (Monochrome)" : "High-Res Full Color"}
            </span>
          </div>

          <div className="flex justify-between py-1.5">
            <span className="text-zinc-500">Duplex / Sides</span>
            <span className="font-semibold text-zinc-900 capitalize">
              {activeSettings?.duplex === "double" ? "2-Sided (Back to Back)" : "Single Sided"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
