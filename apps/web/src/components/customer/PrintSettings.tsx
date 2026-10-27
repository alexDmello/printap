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

// ─── Premium Micro-Components ───

const IconColor = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="url(#rainbow)">
    <defs>
      <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="50%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
    </defs>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);

const IconBW = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2V4a8 8 0 000 16z" />
  </svg>
);

const IconSingleSide = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M9 11h6M9 15h4" />
  </svg>
);

const IconDoubleSide = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v14a2 2 0 002 2h10a2 2 0 002-2V7m-6-4H4a2 2 0 00-2 2v14M8 3v14" />
  </svg>
);

const IconPortrait = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="3" width="12" height="18" rx="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 7h4M10 11h4M10 15h2" />
  </svg>
);

const IconLandscape = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10h4M7 14h6" />
  </svg>
);

const IconGrid = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="4" y="4" width="6" height="6" rx="1" strokeWidth={2} />
    <rect x="14" y="4" width="6" height="6" rx="1" strokeWidth={2} />
    <rect x="4" y="14" width="6" height="6" rx="1" strokeWidth={2} />
    <rect x="14" y="14" width="6" height="6" rx="1" strokeWidth={2} />
  </svg>
);

function getIconForValue(val: string) {
  switch (val) {
    case "color": return <IconColor />;
    case "bw": return <IconBW />;
    case "single": return <IconSingleSide />;
    case "double": return <IconDoubleSide />;
    case "portrait": return <IconPortrait />;
    case "landscape": return <IconLandscape />;
    case "2": 
    case "4": return <IconGrid />;
    case "1": return <IconSingleSide />;
    default: return null;
  }
}

function CompactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-1 border-b border-zinc-100/50 last:border-0">
      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="w-full">{children}</div>
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
  const gridCols = options.length > 2 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={`grid ${gridCols} gap-1.5 w-full`}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const Icon = getIconForValue(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex flex-row items-center justify-center px-2 h-[44px] rounded-lg border-2 transition-all duration-200 overflow-hidden cursor-pointer active:scale-95 ${
              isSelected
                ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                : "border-zinc-200 bg-white hover:border-emerald-300 hover:shadow-sm"
            }`}
          >
            {isSelected && (
              <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-sm animate-fade-in">
                <svg className="w-1.5 h-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
            )}
            {Icon && (
              <div className={`mr-1.5 ${isSelected ? "text-emerald-600" : "text-zinc-400"} transition-transform duration-300`}>
                <div className="scale-75 origin-center">{Icon}</div>
              </div>
            )}
            <div className="flex flex-col items-center justify-center leading-none">
               <span className={`text-[11px] font-bold tracking-tight ${isSelected ? "text-emerald-900" : "text-zinc-700"}`}>{opt.label}</span>
               {opt.sublabel && (
                 <span className={`text-[9px] font-medium mt-[2px] ${isSelected ? "text-emerald-700/80" : "text-zinc-500"}`}>{opt.sublabel}</span>
               )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PremiumGridSelector({ 
  value, 
  onChange,
  options = [
    { value: "1", label: "1-in-1", grids: [1] },
    { value: "2", label: "2-in-1", grids: [1, 2] },
    { value: "4", label: "4-in-1", grids: [1, 2, 3, 4] },
  ]
}: { 
  value: string, 
  onChange: (v: string) => void,
  options?: { value: string, label: string, grids: number[] }[]
}) {
  return (
    <div className="flex bg-zinc-100/80 p-1 rounded-xl w-full border border-zinc-200/60 shadow-inner">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const total = opt.grids.length;
        
        let cols = 1;
        let rows = 1;
        if (total === 2) { cols = 1; rows = 2; }
        else if (total === 4) { cols = 2; rows = 2; }
        else if (total === 6) { cols = 2; rows = 3; }
        else if (total === 9) { cols = 3; rows = 3; }
        
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all duration-300 cursor-pointer ${
              isSelected 
                ? "bg-white shadow-sm border-zinc-200 text-emerald-600" 
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            }`}
          >
            <div 
               className={`w-6 h-8 rounded-sm border-2 grid gap-[1px] p-[1px] mb-1.5 transition-colors ${
                 isSelected ? "border-emerald-500 bg-emerald-50" : "border-zinc-300 bg-white"
               }`}
               style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
            >
              {opt.grids.map(g => (
                <div key={g} className={`rounded-[1px] ${isSelected ? 'bg-emerald-200' : 'bg-zinc-200'}`} />
              ))}
            </div>
            <span className={`text-[9px] sm:text-[10px] font-bold tracking-wide ${isSelected ? "text-emerald-800" : ""}`}>{opt.label}</span>
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
    <div className="flex items-center justify-between bg-zinc-50/80 p-1 rounded-lg border border-zinc-200/80 shadow-inner h-[44px]">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-10 h-full rounded-[6px] bg-white text-zinc-800 font-bold text-xl shadow-sm border border-zinc-200/80 hover:bg-zinc-100 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
        disabled={value <= 1}
        aria-label="Decrease copies"
      >
        −
      </button>
      <div className="flex flex-row items-baseline justify-center gap-1.5 px-2">
        <span className="font-extrabold text-xl text-zinc-900 tracking-tighter tabular-nums leading-none">{value}</span>
        <span className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">cp</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="w-10 h-full rounded-[6px] bg-emerald-500 text-white font-bold text-xl shadow-md border border-emerald-600/50 hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
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
    const isDouble = imageBatchSettings?.duplex === "double";
    return isDouble
      ? Math.ceil(logicalPages / 2)
      : logicalPages;
  }, [imageDocs.length, imageBatchGrid, imageBatchSettings?.duplex]);

  // Live Sheet Preview for Images
  const [imagePreviewSheet, setImagePreviewSheet] = useState(0);
  const totalImagePreviewSheets = Math.max(1, Math.ceil(imageDocs.length / imageBatchGrid));
  const currentPreviewSheetClamped = Math.min(imagePreviewSheet, totalImagePreviewSheets - 1);
  const currentSheetPhotos = useMemo(() => {
    const start = currentPreviewSheetClamped * imageBatchGrid;
    return imageDocs.slice(start, start + imageBatchGrid);
  }, [currentPreviewSheetClamped, imageBatchGrid, imageDocs]);

  return (
    <div className="space-y-5 pb-6 animate-fade-in-up">
      {/* ── Premium Header ── */}
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex flex-col">
          <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight">Print Settings</h2>
          <span className="text-[13px] font-medium text-zinc-500 mt-0.5">
            Customize how your {documents.length === 1 ? "file" : "files"} will be printed
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200/60">
            {documents.length} {documents.length === 1 ? "file" : "files"}
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">Click card to expand</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. CONTAINERS FOR EACH NON-IMAGE DOCUMENT (PDF, etc.)
      ───────────────────────────────────────────────────────────── */}
      {pdfDocs.map((doc) => {
        const isExpanded = Boolean(expandedIds[doc.id]);
        return (
          <div
            key={doc.id}
            className="rounded-3xl border-2 border-zinc-100/80 shadow-sm overflow-hidden transition-all bg-white"
          >
            {/* Premium Document Header */}
            <div
              onClick={() => toggleExpand(doc.id)}
              className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-50/80 transition-colors select-none"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-extrabold text-zinc-900 truncate max-w-[170px] sm:max-w-xs">
                      {doc.file.name}
                    </span>
                    <span className="text-[10px] font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded-md flex-shrink-0">
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
                    <span>•</span>
                    <span>{doc.settings.duplex === "double" ? "2-Sided" : "1-Sided"}</span>
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
                className={`w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-transform duration-300 cursor-pointer flex-shrink-0 ${
                  isExpanded ? "rotate-180 bg-zinc-200 shadow-inner" : "shadow-sm"
                }`}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
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
                              ? { ...d, settings: { ...d.settings, colorMode: "color" } }
                              : d
                          )
                        );
                      } else {
                        updateDocSetting(doc.id, "colorMode", newColor);
                      }
                    }}
                  />
                </CompactRow>

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

                {doc.pageCount > 1 && (
                  <CompactRow label="Page Range">
                    <input
                      type="text"
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white font-mono text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 w-32"
                      placeholder={`1-${doc.pageCount} (All)`}
                      value={doc.settings.pageRange || ""}
                      onChange={(e) => updateDocSetting(doc.id, "pageRange", e.target.value)}
                    />
                  </CompactRow>
                )}

                <CompactRow label="Pages/Sheet">
                  <PremiumGridSelector
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
                      { value: "portrait", label: "Portrait" },
                      { value: "landscape", label: "Landscape" },
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
        <div className="rounded-3xl border-2 border-indigo-100/80 shadow-sm overflow-hidden transition-all bg-white mb-4">
          {/* Premium Image Header */}
          <div
            onClick={() => toggleExpand("images-batch")}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-50/40 transition-colors select-none"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-extrabold text-zinc-900">Photos & Images</span>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md flex-shrink-0">
                    {imageDocs.length} {imageDocs.length === 1 ? "photo" : "photos"}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="font-bold text-indigo-600">{imageBatchGrid}-in-1 Grid</span>
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
              className={`w-9 h-9 rounded-full bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center transition-transform duration-300 cursor-pointer flex-shrink-0 ${
                expandedIds["images-batch"] ? "rotate-180 bg-indigo-100 shadow-inner" : "shadow-sm border border-indigo-100"
              }`}
              aria-label={expandedIds["images-batch"] ? "Collapse" : "Expand"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Unified Image Settings Panel */}
          {expandedIds["images-batch"] && (
            <div className="p-3 border-t border-indigo-100/70 bg-indigo-50/20 animate-fade-in flex flex-col gap-3">
              {/* 1. TOP: Live Preview Frame */}
              <div className="bg-white p-2.5 rounded-2xl border-2 border-indigo-50 shadow-sm flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-extrabold text-zinc-900 uppercase tracking-wider leading-tight">
                    Paper Preview
                  </span>
                  {totalImagePreviewSheets > 1 && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setImagePreviewSheet((s) => Math.max(0, s - 1))}
                        disabled={currentPreviewSheetClamped === 0}
                        className="w-5 h-5 rounded bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 flex items-center justify-center text-[10px] font-bold cursor-pointer hover:bg-zinc-50"
                      >
                        ‹
                      </button>
                      <span className="text-[9px] font-mono font-bold text-zinc-600 px-1">
                        {currentPreviewSheetClamped + 1} / {totalImagePreviewSheets}
                      </span>
                      <button
                        type="button"
                        onClick={() => setImagePreviewSheet((s) => Math.min(totalImagePreviewSheets - 1, s + 1))}
                        disabled={currentPreviewSheetClamped >= totalImagePreviewSheets - 1}
                        className="w-5 h-5 rounded bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 flex items-center justify-center text-[10px] font-bold cursor-pointer hover:bg-zinc-50"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full flex justify-center py-3 bg-zinc-100/70 rounded-lg border border-zinc-200/80 overflow-hidden shadow-inner">
                  <div
                    className={`relative bg-white transition-all duration-200 overflow-hidden rounded flex flex-col ${
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
                        <div className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-100 rounded-sm">
                          <img 
                             src={currentSheetPhotos[0].thumbnailUrl || URL.createObjectURL(currentSheetPhotos[0].file)}
                             className={`w-full h-full ${imageBatchSettings.pageFit === "fill" ? "object-cover" : "object-contain"}`}
                             alt="preview"
                          />
                        </div>
                      )}

                      {/* 2-in-1 */}
                      {imageBatchGrid === 2 && (
                        <div
                          className={`w-full h-full grid gap-1 ${
                            imageBatchSettings.orientation === "landscape"
                              ? "grid-cols-2 grid-rows-1"
                              : "grid-cols-1 grid-rows-2"
                          }`}
                        >
                          {currentSheetPhotos.map((photo, i) => (
                            <div key={photo.id} className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-100 rounded-sm">
                              <img src={photo.thumbnailUrl || URL.createObjectURL(photo.file)} className={`w-full h-full ${imageBatchSettings.pageFit === "fill" ? "object-cover" : "object-contain"}`} alt={`preview-${i}`} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 4-in-1 */}
                      {imageBatchGrid === 4 && (
                        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1">
                          {currentSheetPhotos.map((photo, i) => (
                            <div key={photo.id} className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-100 rounded-sm">
                              <img src={photo.thumbnailUrl || URL.createObjectURL(photo.file)} className={`w-full h-full ${imageBatchSettings.pageFit === "fill" ? "object-cover" : "object-contain"}`} alt={`preview-${i}`} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 6-in-1 */}
                      {imageBatchGrid === 6 && (
                        <div
                          className={`w-full h-full grid gap-1 ${
                            imageBatchSettings.orientation === "landscape"
                              ? "grid-cols-3 grid-rows-2"
                              : "grid-cols-2 grid-rows-3"
                          }`}
                        >
                          {currentSheetPhotos.map((photo, i) => (
                            <div key={photo.id} className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-100 rounded-sm">
                              <img src={photo.thumbnailUrl || URL.createObjectURL(photo.file)} className={`w-full h-full ${imageBatchSettings.pageFit === "fill" ? "object-cover" : "object-contain"}`} alt={`preview-${i}`} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 9-in-1 */}
                      {imageBatchGrid === 9 && (
                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5">
                          {currentSheetPhotos.map((photo, i) => (
                            <div key={photo.id} className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-100 rounded-[1px]">
                              <img src={photo.thumbnailUrl || URL.createObjectURL(photo.file)} className={`w-full h-full ${imageBatchSettings.pageFit === "fill" ? "object-cover" : "object-contain"}`} alt={`preview-${i}`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. MIDDLE: Grid Selector */}
              <div className="bg-white p-2 rounded-2xl border-2 border-indigo-50 shadow-sm">
                <PremiumGridSelector
                  value={String(imageBatchGrid)}
                  options={[
                    { value: "1", label: "1-in-1", grids: [1] },
                    { value: "2", label: "2-in-1", grids: [1, 2] },
                    { value: "4", label: "4-in-1", grids: [1, 2, 3, 4] },
                    { value: "6", label: "6-in-1", grids: [1, 2, 3, 4, 5, 6] },
                    { value: "9", label: "9-in-1", grids: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
                  ]}
                  onChange={(v) => {
                    const gridVal = Number(v) as PagesPerSheet;
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
                />
              </div>

              {/* 3. BOTTOM: Setting Controls (Two Options Next to Each Other) */}
              <div className="bg-white p-2 rounded-2xl border-2 border-indigo-50 shadow-sm grid grid-cols-2 gap-2">
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
                              ? { ...d, settings: { ...d.settings, colorMode: "color" } }
                              : d
                          )
                        );
                      } else {
                        updateAllImagesSettings("colorMode", newColor);
                      }
                    }}
                  />
                </CompactRow>

                <CompactRow label="Copies">
                  <CompactCopiesStepper
                    value={imageBatchSettings.copies}
                    onChange={(v) => updateAllImagesSettings("copies", v)}
                  />
                </CompactRow>

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

                <CompactRow label="Orientation">
                  <CompactToggle
                    options={[
                      { value: "portrait", label: "Portrait" },
                      { value: "landscape", label: "Landscape" },
                    ]}
                    value={imageBatchSettings.orientation}
                    onChange={(v) =>
                      updateAllImagesSettings("orientation", v as "portrait" | "landscape")
                    }
                  />
                </CompactRow>

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
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. PREMIUM FINISHING ADD-ONS
      ───────────────────────────────────────────────────────────── */}
      {finishingServices.length > 0 && (
        <div className="rounded-3xl border-2 border-emerald-100/80 shadow-sm p-5 bg-white space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-emerald-50">
            <span className="text-[15px] font-extrabold text-zinc-900 tracking-tight">
              Finishing Services
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">
              Optional Add-ons
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {finishingServices.map((service) => (
              <button
                key={service.type}
                type="button"
                onClick={() => toggleFinishing(service.type)}
                className={`flex items-center justify-between p-4 rounded-2xl transition-all border-2 text-left cursor-pointer active:scale-95 ${
                  service.enabled
                    ? "bg-emerald-50 border-emerald-500 shadow-sm"
                    : "bg-white hover:border-emerald-300 border-zinc-200/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      service.enabled
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-zinc-300 bg-zinc-50"
                    }`}
                  >
                    {service.enabled && (
                      <svg
                        className="w-4 h-4 animate-fade-in"
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
                    <span className={`text-[13px] font-bold block leading-tight ${service.enabled ? "text-emerald-900" : "text-zinc-800"}`}>{service.label}</span>
                    <span
                      className={`text-[11px] font-medium ${
                        service.enabled ? "text-emerald-700/80" : "text-zinc-500"
                      }`}
                    >
                      {service.chargeUnit === "per_sheet" ? "per sheet" : "per set"}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[15px] font-mono font-extrabold ${
                    service.enabled ? "text-emerald-600" : "text-zinc-400"
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
