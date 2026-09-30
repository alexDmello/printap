"use client";

import React, { useState, useMemo } from "react";
import type {
  UploadedDocument,
  PrintSettings,
  ColorMode,
  DuplexMode,
  PagesPerSheet,
  FinishingService,
  ShopRateCard,
} from "@printap/shared";

// ─── Sub-components ───

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-zinc-100 last:border-b-0 gap-3">
      <div>
        <div className="text-xs font-semibold text-zinc-900">{label}</div>
        {description && (
          <div className="text-[11px] text-zinc-400 mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
    </div>
  );
}

function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; sublabel?: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-zinc-100 border border-zinc-200/80 shadow-inner flex-wrap gap-1">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer ${
              isSelected
                ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/10 scale-[1.02]"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
            }`}
          >
            {isSelected && <span className="text-emerald-400 text-[10px]">●</span>}
            <span>{opt.label}</span>
            {opt.sublabel && (
              <span
                className={`text-[10px] ml-0.5 font-normal ${
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

function CopiesStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl border border-zinc-200/80">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 text-zinc-900 font-bold transition flex items-center justify-center text-sm shadow-sm active:scale-95 cursor-pointer"
        aria-label="Decrease copies"
      >
        −
      </button>
      <span className="w-7 text-center font-mono font-bold text-sm text-zinc-900">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 text-zinc-900 font-bold transition flex items-center justify-center text-sm shadow-sm active:scale-95 cursor-pointer"
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
  // Default to expanding the first PDF and/or image container
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

  // Calculate sheets for the images batch
  const imageBatchGrid = imageBatchSettings?.pagesPerSheet || 1;
  const imageBatchSheetsPerCopy = useMemo(() => {
    if (imageDocs.length === 0) return 0;
    const logicalPages = Math.ceil(imageDocs.length / imageBatchGrid);
    return imageBatchSettings?.duplex === "double"
      ? Math.ceil(logicalPages / 2)
      : logicalPages;
  }, [imageDocs.length, imageBatchGrid, imageBatchSettings?.duplex]);

  // Live Sheet Preview for Images according to User's Settings
  const [imagePreviewSheet, setImagePreviewSheet] = useState(0);
  const totalImagePreviewSheets = Math.max(1, Math.ceil(imageDocs.length / imageBatchGrid));
  const currentPreviewSheetClamped = Math.min(imagePreviewSheet, totalImagePreviewSheets - 1);
  const currentSheetPhotos = useMemo(() => {
    const start = currentPreviewSheetClamped * imageBatchGrid;
    return imageDocs.slice(start, start + imageBatchGrid);
  }, [currentPreviewSheetClamped, imageBatchGrid, imageDocs]);

  return (
    <div className="space-y-4 pb-8 animate-fade-in-up">
      {/* ── Heading / Intro ── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Print Specifications</h2>
          <p className="text-[11px] text-zinc-500">
            Customize print layout, color mode, and copies per document
          </p>
        </div>
        <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
          {documents.length} {documents.length === 1 ? "file" : "files"}
        </span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. CONTAINERS FOR EACH NON-IMAGE DOCUMENT (PDF, etc.)
          Each document gets its own container with a dropdown arrow
      ───────────────────────────────────────────────────────────── */}
      {pdfDocs.map((doc, idx) => {
        const isExpanded = Boolean(expandedIds[doc.id]);
        return (
          <div
            key={doc.id}
            className="glass rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden transition-all bg-white/90"
          >
            {/* Container Header with Dropdown Arrow */}
            <div
              onClick={() => toggleExpand(doc.id)}
              className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-50/70 transition-colors select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 truncate max-w-[200px] sm:max-w-xs">
                      {doc.file.name}
                    </span>
                    <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/80 flex-shrink-0">
                      PDF
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2">
                    <span>
                      {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{doc.settings.colorMode === "color" ? "Full Color" : "B&W"}</span>
                    <span>•</span>
                    <span>{doc.settings.copies} {doc.settings.copies === 1 ? "copy" : "copies"}</span>
                  </div>
                </div>
              </div>

              {/* Arrow to Show / Hide Dropdown */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(doc.id);
                  }}
                  className={`w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-transform duration-200 cursor-pointer ${
                    isExpanded ? "rotate-180 bg-zinc-200" : ""
                  }`}
                  aria-label={isExpanded ? "Collapse options" : "Expand options"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Dropdown Options Container */}
            {isExpanded && (
              <div className="px-5 pb-5 pt-1 border-t border-zinc-100 bg-zinc-50/40 space-y-1 animate-fade-in">
                {/* Copies */}
                <SettingRow label="Number of Copies" description="Total identical sets to print">
                  <CopiesStepper
                    value={doc.settings.copies}
                    onChange={(v) => updateDocSetting(doc.id, "copies", v)}
                  />
                </SettingRow>

                {/* Color Mode */}
                <SettingRow
                  label="Color Reproduction"
                  description={
                    colorAvailable
                      ? "Monochrome or high-definition color"
                      : "Color currently unavailable at this shop"
                  }
                >
                  <SegmentedToggle
                    options={
                      colorAvailable
                        ? [
                            { value: "bw", label: "B&W", sublabel: `₹${rateCard.priceBwPerPage}` },
                            { value: "color", label: "Color", sublabel: `₹${rateCard.priceColorPerPage}` },
                          ]
                        : [{ value: "bw", label: "B&W Only", sublabel: `₹${rateCard.priceBwPerPage}` }]
                    }
                    value={doc.settings.colorMode}
                    onChange={(v) => updateDocSetting(doc.id, "colorMode", v as ColorMode)}
                  />
                </SettingRow>

                {/* Duplex / Sides */}
                <SettingRow label="Paper Sides" description="Single-sided or back-to-back">
                  <SegmentedToggle
                    options={[
                      { value: "single", label: "Single Sided" },
                      { value: "double", label: "Duplex (2-sided)" },
                    ]}
                    value={doc.settings.duplex}
                    onChange={(v) => updateDocSetting(doc.id, "duplex", v as DuplexMode)}
                  />
                </SettingRow>

                {/* Pages Per Sheet */}
                <SettingRow label="Pages Per Sheet" description="Condense multiple document pages onto one paper sheet">
                  <SegmentedToggle
                    options={[
                      { value: "1", label: "1 per sheet" },
                      { value: "2", label: "2-in-1" },
                      { value: "4", label: "4-in-1" },
                    ]}
                    value={String(doc.settings.pagesPerSheet)}
                    onChange={(v) =>
                      updateDocSetting(doc.id, "pagesPerSheet", Number(v) as PagesPerSheet)
                    }
                  />
                </SettingRow>

                {/* Orientation */}
                <SettingRow label="Sheet Orientation" description="Page layout orientation">
                  <SegmentedToggle
                    options={[
                      { value: "portrait", label: "Portrait ▯" },
                      { value: "landscape", label: "Landscape ▭" },
                    ]}
                    value={doc.settings.orientation}
                    onChange={(v) =>
                      updateDocSetting(doc.id, "orientation", v as "portrait" | "landscape")
                    }
                  />
                </SettingRow>
              </div>
            )}
          </div>
        );
      })}

      {/* ─────────────────────────────────────────────────────────────
          2. UNIFIED CONTAINER FOR ALL UPLOADED IMAGES
          If the user uploads images, all are in ONE container with
          grid layout options: 1in1, 2in1, 4in1, 6in1, 9in1
      ───────────────────────────────────────────────────────────── */}
      {imageDocs.length > 0 && imageBatchSettings && (
        <div className="glass rounded-2xl border-2 border-indigo-200/80 shadow-xs overflow-hidden transition-all bg-white/95">
          {/* Header of Unified Image Container */}
          <div
            onClick={() => toggleExpand("images-batch")}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-indigo-50/40 transition-colors select-none"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900">
                    Photos & Images
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 flex-shrink-0">
                    {imageDocs.length} {imageDocs.length === 1 ? "photo" : "photos"}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2">
                  <span className="font-semibold text-indigo-600">
                    {imageBatchGrid}-in-1 Grid
                  </span>
                  <span>•</span>
                  <span>{imageBatchSheetsPerCopy} {imageBatchSheetsPerCopy === 1 ? "sheet" : "sheets"}/copy</span>
                  <span>•</span>
                  <span>{imageBatchSettings.copies} {imageBatchSettings.copies === 1 ? "copy" : "copies"}</span>
                </div>
              </div>
            </div>

            {/* Dropdown Chevron Toggle Arrow */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand("images-batch");
                }}
                className={`w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-transform duration-200 cursor-pointer ${
                  expandedIds["images-batch"] ? "rotate-180 bg-zinc-200" : ""
                }`}
                aria-label={expandedIds["images-batch"] ? "Collapse options" : "Expand options"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Unified Image Dropdown Options */}
          {expandedIds["images-batch"] && (
            <div className="px-5 pb-5 pt-1 border-t border-indigo-100/80 bg-indigo-50/20 space-y-3 animate-fade-in">
              {/* Photo Strip / Gallery Preview */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider">
                    Uploaded Photos in this Batch ({imageDocs.length})
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Scroll horizontally to view all
                  </span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                  {imageDocs.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative w-16 h-16 rounded-xl bg-white border border-zinc-200 overflow-hidden flex-shrink-0 shadow-xs group"
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
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-zinc-900/80 text-white flex items-center justify-center text-[10px] opacity-80 hover:opacity-100 transition cursor-pointer"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid Layout Selector: 1in1, 2in1, 4in1, 6in1, 9in1 */}
              <div className="p-3.5 rounded-xl bg-white border border-indigo-200/70 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-zinc-900">
                      Photo Grid Layout (Per Paper Sheet)
                    </span>
                    <p className="text-[11px] text-zinc-500">
                      Combine multiple photos neatly onto a single sheet of paper
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {imageBatchGrid}-in-1
                  </span>
                </div>

                {/* Grid Options Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {[
                    { value: 1, label: "1-in-1", desc: "1 per page" },
                    { value: 2, label: "2-in-1", desc: "2 per page" },
                    { value: 4, label: "4-in-1", desc: "2×2 grid" },
                    { value: 6, label: "6-in-1", desc: "2×3 grid" },
                    { value: 9, label: "9-in-1", desc: "3×3 grid" },
                  ].map((g) => {
                    const isSelected = imageBatchGrid === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => updateAllImagesSettings("pagesPerSheet", g.value as PagesPerSheet)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-md scale-[1.02]"
                            : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200/80 text-zinc-700"
                        }`}
                      >
                        <div className="text-xs font-bold font-mono">{g.label}</div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            isSelected ? "text-zinc-300" : "text-zinc-400"
                          }`}
                        >
                          {g.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-indigo-700 bg-indigo-50/70 p-2 rounded-lg border border-indigo-100 flex items-center gap-1.5 mt-2">
                  <span>💡</span>
                  <span>
                    <strong>{imageDocs.length} photos</strong> in <strong>{imageBatchGrid}-in-1 layout</strong> will fit on{" "}
                    <strong>{imageBatchSheetsPerCopy} {imageBatchSheetsPerCopy === 1 ? "sheet" : "sheets"}</strong> of paper per set.
                  </span>
                </div>

                {/* ── Live Sheet Preview for Images according to User's Settings ── */}
                <div className="mt-3 pt-3 border-t border-indigo-100/80 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                        Sheet Preview
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                        {imageBatchGrid}-in-1 • {imageBatchSettings.colorMode === "color" ? "Full Color" : "B&W"}
                      </span>
                    </div>
                    {totalImagePreviewSheets > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setImagePreviewSheet((s) => Math.max(0, s - 1))}
                          disabled={currentPreviewSheetClamped === 0}
                          className="w-5 h-5 rounded-md bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs font-bold shadow-xs hover:bg-zinc-50 cursor-pointer"
                        >
                          ‹
                        </button>
                        <span className="text-[10px] font-mono font-bold text-zinc-600">
                          Sheet {currentPreviewSheetClamped + 1} of {totalImagePreviewSheets}
                        </span>
                        <button
                          type="button"
                          onClick={() => setImagePreviewSheet((s) => Math.min(totalImagePreviewSheets - 1, s + 1))}
                          disabled={currentPreviewSheetClamped >= totalImagePreviewSheets - 1}
                          className="w-5 h-5 rounded-md bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs font-bold shadow-xs hover:bg-zinc-50 cursor-pointer"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Paper Simulation Viewport */}
                  <div className="w-full flex items-center justify-center py-3 bg-zinc-100/80 rounded-xl border border-zinc-200 overflow-hidden shadow-inner">
                    <div
                      className={`relative bg-white transition-all duration-300 overflow-hidden rounded-xs flex flex-col ${
                        imageBatchSettings.orientation === "landscape"
                          ? "w-[220px] sm:w-[250px] h-[155px] sm:h-[176px]"
                          : "w-[155px] sm:w-[176px] h-[220px] sm:h-[250px]"
                      }`}
                      style={{
                        boxShadow: "0 6px 16px -3px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.25)",
                        filter: imageBatchSettings.colorMode === "bw"
                          ? "grayscale(100%) contrast(1.1) brightness(0.98)"
                          : "none",
                      }}
                    >
                      <div className="w-full h-full p-2 flex items-center justify-center overflow-hidden">
                        {/* 1-in-1 */}
                        {imageBatchGrid === 1 && currentSheetPhotos[0] && (
                          <div className="w-full h-full flex items-center justify-center overflow-hidden">
                            <img
                              src={currentSheetPhotos[0].thumbnailUrl}
                              alt="Preview"
                              className="max-w-full max-h-full object-contain"
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
                          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1">
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
                            className={`w-full h-full grid gap-1 ${
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

              {/* Number of Copies */}
              <SettingRow label="Number of Copies" description="Sets of this photo collection to print">
                <CopiesStepper
                  value={imageBatchSettings.copies}
                  onChange={(v) => updateAllImagesSettings("copies", v)}
                />
              </SettingRow>

              {/* Color Mode */}
              <SettingRow
                label="Color Reproduction"
                description={
                  colorAvailable
                    ? "Vibrant photo color or black & white"
                    : "Color currently unavailable at this counter"
                }
              >
                <SegmentedToggle
                  options={
                    colorAvailable
                      ? [
                          { value: "bw", label: "B&W", sublabel: `₹${rateCard.priceBwPerPage}` },
                          { value: "color", label: "Full Color", sublabel: `₹${rateCard.priceColorPerPage}` },
                        ]
                      : [{ value: "bw", label: "B&W Only", sublabel: `₹${rateCard.priceBwPerPage}` }]
                  }
                  value={imageBatchSettings.colorMode}
                  onChange={(v) => updateAllImagesSettings("colorMode", v as ColorMode)}
                />
              </SettingRow>

              {/* Duplex / Sides */}
              <SettingRow label="Paper Sides" description="Single-sided or back-to-back">
                <SegmentedToggle
                  options={[
                    { value: "single", label: "Single Sided" },
                    { value: "double", label: "Duplex (2-sided)" },
                  ]}
                  value={imageBatchSettings.duplex}
                  onChange={(v) => updateAllImagesSettings("duplex", v as DuplexMode)}
                />
              </SettingRow>

              {/* Orientation */}
              <SettingRow label="Sheet Orientation" description="Paper orientation for photo grid">
                <SegmentedToggle
                  options={[
                    { value: "portrait", label: "Portrait ▯" },
                    { value: "landscape", label: "Landscape ▭" },
                  ]}
                  value={imageBatchSettings.orientation}
                  onChange={(v) =>
                    updateAllImagesSettings("orientation", v as "portrait" | "landscape")
                  }
                />
              </SettingRow>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. FINISHING ADD-ONS
      ───────────────────────────────────────────────────────────── */}
      {finishingServices.length > 0 && (
        <div className="glass rounded-2xl p-5 glow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
            <div>
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Finishing & Value-Added Services
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Select optional post-print processing</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              At Counter
            </span>
          </div>

          <div className="space-y-2">
            {finishingServices.map((service) => (
              <button
                key={service.type}
                type="button"
                onClick={() => toggleFinishing(service.type)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border text-left cursor-pointer ${
                  service.enabled
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                    : "bg-zinc-50 hover:bg-zinc-100/80 border-zinc-200/80 text-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      service.enabled
                        ? "border-emerald-400 bg-emerald-500 text-white"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    {service.enabled && (
                      <svg
                        className="w-3.5 h-3.5"
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
                    <span className="text-xs font-bold block">{service.label}</span>
                    <span
                      className={`text-[10px] ${
                        service.enabled ? "text-zinc-300" : "text-zinc-400"
                      }`}
                    >
                      {service.chargeUnit === "per_sheet"
                        ? "Charged per printed sheet"
                        : "Charged per copy set"}
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
