"use client";

import React, { useState, useMemo } from "react";
import type {
  UploadedDocument,
  PrintSettings,
  ColorMode,
  DuplexMode,
  PagesPerSheet,
  PageFit,
  FinishingService,
  ShopRateCard,
} from "@printap/shared";

// ─── Compact Micro-Components ───

function CompactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-b-0 gap-2">
      <span className="text-xs font-semibold text-zinc-700 whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">{children}</div>
    </div>
  );
}

function CompactToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; sublabel?: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-zinc-100/90 border border-zinc-200/80 gap-0.5">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              isSelected
                ? "bg-zinc-900 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
          >
            <span>{opt.label}</span>
            {opt.sublabel && (
              <span
                className={`text-[9px] font-normal ${
                  isSelected ? "text-zinc-300" : "text-zinc-400"
                }`}
              >
                {opt.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CompactCopiesStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100/90 p-0.5 rounded-lg border border-zinc-200/80">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-6 h-6 rounded-md bg-white hover:bg-zinc-200 text-zinc-900 font-bold transition flex items-center justify-center text-xs shadow-xs active:scale-95 cursor-pointer"
        aria-label="Decrease copies"
      >
        −
      </button>
      <span className="w-6 text-center font-mono font-bold text-xs text-zinc-900">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="w-6 h-6 rounded-md bg-white hover:bg-zinc-200 text-zinc-900 font-bold transition flex items-center justify-center text-xs shadow-xs active:scale-95 cursor-pointer"
        aria-label="Increase copies"
      >
        +
      </button>
    </div>
  );
}

// ─── Main Component ───

interface PrintSettingsProps {
  documents: UploadedDocument[];
  onDocumentsChange: (docs: UploadedDocument[]) => void;
  rateCard: ShopRateCard;
  finishingServices: FinishingService[];
  onFinishingChange: (services: FinishingService[]) => void;
  colorAvailable?: boolean;
}

export default function PrintSettingsPanel({
  documents,
  onDocumentsChange,
  rateCard,
  finishingServices,
  onFinishingChange,
  colorAvailable = true,
}: PrintSettingsProps) {
  // Separate non-image documents (e.g. PDFs) and image documents
  const pdfDocs = useMemo(
    () => documents.filter((d) => d.type !== "image"),
    [documents]
  );
  const imageDocs = useMemo(
    () => documents.filter((d) => d.type === "image"),
    [documents]
  );

  // Expanded/collapsed state for containers
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (pdfDocs.length > 0) initial[pdfDocs[0].id] = true;
    if (imageDocs.length > 0) initial["images-batch"] = true;
    return initial;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Applies a setting change to a specific document
  const updateDocSetting = (
    docId: string,
    key: keyof PrintSettings,
    value: unknown
  ) => {
    onDocumentsChange(
      documents.map((doc) =>
        doc.id === docId
          ? { ...doc, settings: { ...doc.settings, [key]: value } }
          : doc
      )
    );
  };

  // Applies a setting change to ALL image documents in the unified container
  const updateAllImagesSettings = (
    key: keyof PrintSettings,
    value: unknown
  ) => {
    onDocumentsChange(
      documents.map((doc) =>
        doc.type === "image"
          ? { ...doc, settings: { ...doc.settings, [key]: value } }
          : doc
      )
    );
  };

  // Remove an individual image from the batch
  const handleRemoveDoc = (docId: string) => {
    onDocumentsChange(documents.filter((d) => d.id !== docId));
  };

  const toggleFinishing = (type: string) => {
    onFinishingChange(
      finishingServices.map((s) =>
        s.type === type ? { ...s, enabled: !s.enabled } : s
      )
    );
  };

  // Common image batch settings (taken from first image or default)
  const imageBatchSettings = imageDocs[0]?.settings;
  const imageBatchGrid = imageBatchSettings?.pagesPerSheet || 1;
  const imageBatchSheetsPerCopy = useMemo(() => {
    if (imageDocs.length === 0) return 0;
    const logicalPages = Math.ceil(imageDocs.length / imageBatchGrid);
    const isDouble = imageBatchSettings?.colorMode !== "color" && imageBatchSettings?.duplex === "double";
    return isDouble
      ? Math.ceil(logicalPages / 2)
      : logicalPages;
  }, [imageDocs.length, imageBatchGrid, imageBatchSettings?.duplex, imageBatchSettings?.colorMode]);

  // Live Sheet Preview for Images
  const [imagePreviewSheet, setImagePreviewSheet] = useState(0);
  const totalImagePreviewSheets = Math.max(1, Math.ceil(imageDocs.length / imageBatchGrid));
  const currentPreviewSheetClamped = Math.min(imagePreviewSheet, totalImagePreviewSheets - 1);
  const currentSheetPhotos = useMemo(() => {
    const start = currentPreviewSheetClamped * imageBatchGrid;
    return imageDocs.slice(start, start + imageBatchGrid);
  }, [currentPreviewSheetClamped, imageBatchGrid, imageDocs]);

  return (
    <div className="space-y-3 pb-4 animate-fade-in-up">
      {/* ── Compact Header ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-zinc-900 tracking-tight">Print Settings</h2>
          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/60">
            {documents.length} {documents.length === 1 ? "file" : "files"}
          </span>
        </div>
        <span className="text-[11px] text-zinc-400 font-medium">Click card to expand</span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. CONTAINERS FOR EACH NON-IMAGE DOCUMENT (PDF, etc.)
      ───────────────────────────────────────────────────────────── */}
      {pdfDocs.map((doc) => {
        const isExpanded = Boolean(expandedIds[doc.id]);
        return (
          <div
            key={doc.id}
            className="rounded-xl border border-zinc-200/90 shadow-2xs overflow-hidden transition-all bg-white"
          >
            {/* Compact Header */}
            <div
              onClick={() => toggleExpand(doc.id)}
              className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-zinc-50/80 transition-colors select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200/70 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-zinc-900 truncate max-w-[170px] sm:max-w-xs">
                      {doc.file.name}
                    </span>
                    <span className="text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200/60 flex-shrink-0">
                      PDF
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span>{doc.pageCount} {doc.pageCount === 1 ? "pg" : "pgs"}</span>
                    <span>•</span>
                    <span className="font-medium text-zinc-700">
                      {doc.settings.colorMode === "color" ? "Color" : "B&W"}
                    </span>
                    <span>•</span>
                    <span>{doc.settings.copies} {doc.settings.copies === 1 ? "copy" : "copies"}</span>
                    {doc.settings.colorMode !== "color" && (
                      <>
                        <span>•</span>
                        <span>{doc.settings.duplex === "double" ? "2-Sided" : "1-Sided"}</span>
                      </>
                    )}
                    {doc.settings.pagesPerSheet === 1 && (
                      <>
                        <span>•</span>
                        <span>{doc.settings.pageFit === "fill" ? "Fill Page" : "Fit to Page"}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(doc.id);
                }}
                className={`w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-transform duration-200 cursor-pointer flex-shrink-0 ${
                  isExpanded ? "rotate-180 bg-zinc-200" : ""
                }`}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Compact Settings Panel */}
            {isExpanded && (
              <div className="px-3.5 pb-3 pt-1 border-t border-zinc-100 bg-zinc-50/50 space-y-0.5 animate-fade-in">
                <CompactRow label="Copies">
                  <CompactCopiesStepper
                    value={doc.settings.copies}
                    onChange={(v) => updateDocSetting(doc.id, "copies", v)}
                  />
                </CompactRow>

                <CompactRow label="Color Mode">
                  <CompactToggle
                    options={
                      colorAvailable
                        ? [
                            { value: "bw", label: "B&W", sublabel: `₹${rateCard.priceBwPerPage}` },
                            { value: "color", label: "Color", sublabel: `₹${rateCard.priceColorPerPage}` },
                          ]
                        : [{ value: "bw", label: "B&W Only", sublabel: `₹${rateCard.priceBwPerPage}` }]
                    }
                    value={doc.settings.colorMode}
                    onChange={(v) => {
                      const newColor = v as ColorMode;
                      if (newColor === "color") {
                        onDocumentsChange(
                          documents.map((d) =>
                            d.id === doc.id
                              ? { ...d, settings: { ...d.settings, colorMode: "color", duplex: "single" } }
                              : d
                          )
                        );
                      } else {
                        updateDocSetting(doc.id, "colorMode", newColor);
                      }
                    }}
                  />
                </CompactRow>

                {doc.settings.colorMode !== "color" && (
                  <CompactRow label="Sides">
                    <CompactToggle
                      options={[
                        { value: "single", label: "1-Sided" },
                        { value: "double", label: "2-Sided" },
                      ]}
                      value={doc.settings.duplex}
                      onChange={(v) => updateDocSetting(doc.id, "duplex", v as DuplexMode)}
                    />
                  </CompactRow>
                )}

                <CompactRow label="Pages/Sheet">
                  <CompactToggle
                    options={[
                      { value: "1", label: "1-in-1" },
                      { value: "2", label: "2-in-1" },
                      { value: "4", label: "4-in-1" },
                    ]}
                    value={String(doc.settings.pagesPerSheet)}
                    onChange={(v) => {
                      const pps = Number(v) as PagesPerSheet;
                      if (pps === 1) {
                        onDocumentsChange(
                          documents.map((d) =>
                            d.id === doc.id
                              ? {
                                  ...d,
                                  settings: {
                                    ...d.settings,
                                    pagesPerSheet: 1,
                                    pageFit: d.settings.pageFit || "fit",
                                  },
                                }
                              : d
                          )
                        );
                      } else {
                        updateDocSetting(doc.id, "pagesPerSheet", pps);
                      }
                    }}
                  />
                </CompactRow>

                {doc.settings.pagesPerSheet === 1 && (
                  <CompactRow label="Page Fit">
                    <CompactToggle
                      options={[
                        { value: "fit", label: "Fit to Page" },
                        { value: "fill", label: "Fill Page" },
                      ]}
                      value={doc.settings.pageFit || "fit"}
                      onChange={(v) => updateDocSetting(doc.id, "pageFit", v as PageFit)}
                    />
                  </CompactRow>
                )}

                <CompactRow label="Orientation">
                  <CompactToggle
                    options={[
                      { value: "portrait", label: "Portrait ▯" },
                      { value: "landscape", label: "Landscape ▭" },
                    ]}
                    value={doc.settings.orientation}
                    onChange={(v) =>
                      updateDocSetting(doc.id, "orientation", v as "portrait" | "landscape")
                    }
                  />
                </CompactRow>
              </div>
            )}
          </div>
        );
      })}

      {/* ─────────────────────────────────────────────────────────────
          2. UNIFIED CONTAINER FOR ALL UPLOADED IMAGES
      ───────────────────────────────────────────────────────────── */}
      {imageDocs.length > 0 && imageBatchSettings && (
        <div className="rounded-xl border border-indigo-200/90 shadow-2xs overflow-hidden transition-all bg-white">
          {/* Compact Header */}
          <div
            onClick={() => toggleExpand("images-batch")}
            className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-indigo-50/40 transition-colors select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/70 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-900">Photos & Images</span>
                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200/70 flex-shrink-0">
                    {imageDocs.length} {imageDocs.length === 1 ? "photo" : "photos"}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="font-semibold text-indigo-600">{imageBatchGrid}-in-1 Grid</span>
                  <span>•</span>
                  <span>{imageBatchSheetsPerCopy} {imageBatchSheetsPerCopy === 1 ? "sheet" : "sheets"}/copy</span>
                  <span>•</span>
                  <span>{imageBatchSettings.copies} {imageBatchSettings.copies === 1 ? "copy" : "copies"}</span>
                  {imageBatchSettings.colorMode !== "color" && (
                    <>
                      <span>•</span>
                      <span>{imageBatchSettings.duplex === "double" ? "2-Sided" : "1-Sided"}</span>
                    </>
                  )}
                  {(imageBatchGrid === 1 || imageDocs.length === 1) && (
                    <>
                      <span>•</span>
                      <span>{imageBatchSettings.pageFit === "fill" ? "Fill Page" : "Fit to Page"}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand("images-batch");
              }}
              className={`w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-transform duration-200 cursor-pointer flex-shrink-0 ${
                expandedIds["images-batch"] ? "rotate-180 bg-zinc-200" : ""
              }`}
              aria-label={expandedIds["images-batch"] ? "Collapse" : "Expand"}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Unified Image Settings Panel */}
          {expandedIds["images-batch"] && (
            <div className="px-3.5 pb-3.5 pt-1 border-t border-indigo-100/70 bg-indigo-50/20 space-y-2.5 animate-fade-in">
              {/* Photo Strip */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Uploaded Photos ({imageDocs.length})
                  </span>
                  <span className="text-[10px] text-zinc-400">Scroll to view</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                  {imageDocs.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative w-12 h-12 rounded-lg bg-white border border-zinc-200 overflow-hidden flex-shrink-0 shadow-2xs group"
                    >
                      {img.thumbnailUrl ? (
                        <img
                          src={img.thumbnailUrl}
                          alt={img.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">
                          #{idx + 1}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(img.id)}
                        className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-zinc-900/80 text-white flex items-center justify-center text-[9px] hover:bg-red-600 transition cursor-pointer"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid Selector */}
              <div className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800">
                    Photo Grid Layout
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    {imageBatchGrid}-in-1
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { value: 1, label: "1-in-1" },
                    { value: 2, label: "2-in-1" },
                    { value: 4, label: "4-in-1" },
                    { value: 6, label: "6-in-1" },
                    { value: 9, label: "9-in-1" },
                  ].map((g) => {
                    const isSelected = imageBatchGrid === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => {
                          const gridVal = g.value as PagesPerSheet;
                          onDocumentsChange(
                            documents.map((d) =>
                              d.type === "image"
                                ? {
                                    ...d,
                                    settings: {
                                      ...d.settings,
                                      pagesPerSheet: gridVal,
                                      pageFit: gridVal === 1 ? (d.settings.pageFit || "fit") : d.settings.pageFit,
                                    },
                                  }
                                : d
                            )
                          );
                        }}
                        className={`py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                            : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200/70 text-zinc-700"
                        }`}
                      >
                        <div className="text-[11px] font-bold font-mono">{g.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-indigo-800 bg-indigo-50/60 px-2 py-1 rounded-md flex items-center gap-1">
                  <span>💡</span>
                  <span>
                    <strong>{imageDocs.length} photos</strong> fit on <strong>{imageBatchSheetsPerCopy} {imageBatchSheetsPerCopy === 1 ? "sheet" : "sheets"}</strong>/set.
                  </span>
                </div>

                {/* ── Compact Live Sheet Preview ── */}
                <div className="mt-2 pt-2 border-t border-indigo-100/70">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">
                      Live Paper Preview
                    </span>
                    {totalImagePreviewSheets > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setImagePreviewSheet((s) => Math.max(0, s - 1))}
                          disabled={currentPreviewSheetClamped === 0}
                          className="w-4 h-4 rounded bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                        >
                          ‹
                        </button>
                        <span className="text-[9px] font-mono font-bold text-zinc-600">
                          {currentPreviewSheetClamped + 1}/{totalImagePreviewSheets}
                        </span>
                        <button
                          type="button"
                          onClick={() => setImagePreviewSheet((s) => Math.min(totalImagePreviewSheets - 1, s + 1))}
                          disabled={currentPreviewSheetClamped >= totalImagePreviewSheets - 1}
                          className="w-4 h-4 rounded bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Compact Simulation Frame */}
                  <div className="w-full flex items-center justify-center py-2 bg-zinc-100/70 rounded-lg border border-zinc-200/80 overflow-hidden shadow-inner">
                    <div
                      className={`relative bg-white transition-all duration-200 overflow-hidden rounded-xs flex flex-col ${
                        imageBatchSettings.orientation === "landscape"
                          ? "w-[160px] h-[113px]"
                          : "w-[113px] h-[160px]"
                      }`}
                      style={{
                        boxShadow: "0 4px 10px -2px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.2)",
                        filter: imageBatchSettings.colorMode === "bw"
                          ? "grayscale(100%) contrast(1.1) brightness(0.98)"
                          : "none",
                      }}
                    >
                      <div
                        className={`w-full h-full flex items-center justify-center overflow-hidden ${
                          imageBatchGrid === 1 && imageBatchSettings.pageFit === "fill" ? "p-0" : "p-1.5"
                        }`}
                      >
                        {/* 1-in-1 */}
                        {imageBatchGrid === 1 && currentSheetPhotos[0] && (
                          <div className="w-full h-full flex items-center justify-center overflow-hidden">
                            <img
                              src={currentSheetPhotos[0].thumbnailUrl}
                              alt="Preview"
                              className={
                                imageBatchSettings.pageFit === "fill"
                                  ? "w-full h-full object-cover"
                                  : "max-w-full max-h-full object-contain"
                              }
                            />
                          </div>
                        )}

                        {/* 2-in-1 */}
                        {imageBatchGrid === 2 && (
                          <div
                            className={`w-full h-full grid gap-0.5 ${
                              imageBatchSettings.orientation === "landscape"
                                ? "grid-cols-2 grid-rows-1"
                                : "grid-cols-1 grid-rows-2"
                            }`}
                          >
                            {currentSheetPhotos.map((photo) => (
                              <div
                                key={photo.id}
                                className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-50 rounded-xs"
                              >
                                <img
                                  src={photo.thumbnailUrl}
                                  alt="Preview"
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 4-in-1 */}
                        {imageBatchGrid === 4 && (
                          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
                            {currentSheetPhotos.map((photo) => (
                              <div
                                key={photo.id}
                                className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-50 rounded-xs"
                              >
                                <img
                                  src={photo.thumbnailUrl}
                                  alt="Preview"
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 6-in-1 */}
                        {imageBatchGrid === 6 && (
                          <div
                            className={`w-full h-full grid gap-0.5 ${
                              imageBatchSettings.orientation === "landscape"
                                ? "grid-cols-3 grid-rows-2"
                                : "grid-cols-2 grid-rows-3"
                            }`}
                          >
                            {currentSheetPhotos.map((photo) => (
                              <div
                                key={photo.id}
                                className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-50 rounded-xs"
                              >
                                <img
                                  src={photo.thumbnailUrl}
                                  alt="Preview"
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 9-in-1 */}
                        {imageBatchGrid === 9 && (
                          <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5">
                            {currentSheetPhotos.map((photo) => (
                              <div
                                key={photo.id}
                                className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-50 rounded-xs"
                              >
                                <img
                                  src={photo.thumbnailUrl}
                                  alt="Preview"
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Setting Controls */}
              <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs space-y-0.5">
                <CompactRow label="Copies">
                  <CompactCopiesStepper
                    value={imageBatchSettings.copies}
                    onChange={(v) => updateAllImagesSettings("copies", v)}
                  />
                </CompactRow>

                <CompactRow label="Color Mode">
                  <CompactToggle
                    options={
                      colorAvailable
                        ? [
                            { value: "bw", label: "B&W", sublabel: `₹${rateCard.priceBwPerPage}` },
                            { value: "color", label: "Color", sublabel: `₹${rateCard.priceColorPerPage}` },
                          ]
                        : [{ value: "bw", label: "B&W Only", sublabel: `₹${rateCard.priceBwPerPage}` }]
                    }
                    value={imageBatchSettings.colorMode}
                    onChange={(v) => {
                      const newColor = v as ColorMode;
                      if (newColor === "color") {
                        onDocumentsChange(
                          documents.map((d) =>
                            d.type === "image"
                              ? { ...d, settings: { ...d.settings, colorMode: "color", duplex: "single" } }
                              : d
                          )
                        );
                      } else {
                        updateAllImagesSettings("colorMode", newColor);
                      }
                    }}
                  />
                </CompactRow>

                {imageBatchSettings.colorMode !== "color" && (
                  <CompactRow label="Sides">
                    <CompactToggle
                      options={[
                        { value: "single", label: "1-Sided" },
                        { value: "double", label: "2-Sided" },
                      ]}
                      value={imageBatchSettings.duplex}
                      onChange={(v) => updateAllImagesSettings("duplex", v as DuplexMode)}
                    />
                  </CompactRow>
                )}

                {(imageBatchGrid === 1 || imageDocs.length === 1) && (
                  <CompactRow label="Page Fit">
                    <CompactToggle
                      options={[
                        { value: "fit", label: "Fit to Page" },
                        { value: "fill", label: "Fill Page" },
                      ]}
                      value={imageBatchSettings.pageFit || "fit"}
                      onChange={(v) => updateAllImagesSettings("pageFit", v as PageFit)}
                    />
                  </CompactRow>
                )}

                <CompactRow label="Orientation">
                  <CompactToggle
                    options={[
                      { value: "portrait", label: "Portrait ▯" },
                      { value: "landscape", label: "Landscape ▭" },
                    ]}
                    value={imageBatchSettings.orientation}
                    onChange={(v) =>
                      updateAllImagesSettings("orientation", v as "portrait" | "landscape")
                    }
                  />
                </CompactRow>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. FINISHING ADD-ONS (Compact)
      ───────────────────────────────────────────────────────────── */}
      {finishingServices.length > 0 && (
        <div className="rounded-xl border border-zinc-200/90 shadow-2xs p-3.5 bg-white space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100">
            <span className="text-xs font-bold text-zinc-900 tracking-tight">
              Finishing Services
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Optional Add-ons
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {finishingServices.map((service) => (
              <button
                key={service.type}
                type="button"
                onClick={() => toggleFinishing(service.type)}
                className={`flex items-center justify-between p-2.5 rounded-lg transition-all border text-left cursor-pointer ${
                  service.enabled
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                    : "bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200/80 text-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      service.enabled
                        ? "border-emerald-400 bg-emerald-500 text-white"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    {service.enabled && (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold block leading-tight">{service.label}</span>
                    <span
                      className={`text-[9px] ${
                        service.enabled ? "text-zinc-300" : "text-zinc-400"
                      }`}
                    >
                      {service.chargeUnit === "per_sheet" ? "/sheet" : "/set"}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    service.enabled ? "text-emerald-300" : "text-zinc-900"
                  }`}
                >
                  +₹{service.price}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
