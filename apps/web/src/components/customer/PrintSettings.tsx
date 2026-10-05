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

// ─── Big, Kid-Friendly Components ───

function BigToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon?: string; sublabel?: string; activeClasses?: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const activeBg = opt.activeClasses || "bg-indigo-600 text-white";
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative p-4 sm:p-5 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all duration-300 transform active:scale-95 border-2 ${
              isSelected
                ? `shadow-2xl border-transparent scale-105 ${activeBg}`
                : "bg-white/80 hover:bg-white text-gray-700 shadow-md border-gray-100 hover:-translate-y-1"
            }`}
          >
            {opt.icon && <span className="text-4xl drop-shadow-sm mb-1">{opt.icon}</span>}
            <span className="font-extrabold text-lg sm:text-xl tracking-tight">{opt.label}</span>
            {opt.sublabel && (
              <span className={`text-xs font-bold ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                {opt.sublabel}
              </span>
            )}
            {isSelected && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-inner">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BigStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-6 bg-white/60 p-4 rounded-3xl border border-white shadow-lg backdrop-blur-xl">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-16 h-16 rounded-2xl bg-red-100 hover:bg-red-200 text-red-600 font-black text-3xl transition-transform transform hover:scale-105 active:scale-90 flex items-center justify-center shadow-sm"
      >
        −
      </button>
      <div className="flex flex-col items-center min-w-[80px]">
        <span className="text-5xl font-black text-gray-900 tracking-tighter">{value}</span>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{value === 1 ? 'Copy' : 'Copies'}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="w-16 h-16 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-600 font-black text-3xl transition-transform transform hover:scale-105 active:scale-90 flex items-center justify-center shadow-sm"
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
  const pdfDocs = useMemo(() => documents.filter((d) => d.type !== "image"), [documents]);
  const imageDocs = useMemo(() => documents.filter((d) => d.type === "image"), [documents]);

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (pdfDocs.length > 0) initial[pdfDocs[0].id] = true;
    if (imageDocs.length > 0) initial["images-batch"] = true;
    return initial;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateDocSetting = (docId: string, key: keyof PrintSettings, value: unknown) => {
    onDocumentsChange(
      documents.map((doc) =>
        doc.id === docId ? { ...doc, settings: { ...doc.settings, [key]: value } } : doc
      )
    );
  };

  const updateAllImagesSettings = (key: keyof PrintSettings, value: unknown) => {
    onDocumentsChange(
      documents.map((doc) =>
        doc.type === "image" ? { ...doc, settings: { ...doc.settings, [key]: value } } : doc
      )
    );
  };

  const handleRemoveDoc = (docId: string) => {
    onDocumentsChange(documents.filter((d) => d.id !== docId));
  };

  const toggleFinishing = (type: string) => {
    onFinishingChange(
      finishingServices.map((s) => (s.type === type ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const imageBatchSettings = imageDocs[0]?.settings;
  const imageBatchGrid = imageBatchSettings?.pagesPerSheet || 1;
  const imageBatchSheetsPerCopy = useMemo(() => {
    if (imageDocs.length === 0) return 0;
    const logicalPages = Math.ceil(imageDocs.length / imageBatchGrid);
    const isDouble = imageBatchSettings?.colorMode !== "color" && imageBatchSettings?.duplex === "double";
    return isDouble ? Math.ceil(logicalPages / 2) : logicalPages;
  }, [imageDocs.length, imageBatchGrid, imageBatchSettings?.duplex, imageBatchSettings?.colorMode]);

  const [imagePreviewSheet, setImagePreviewSheet] = useState(0);
  const totalImagePreviewSheets = Math.max(1, Math.ceil(imageDocs.length / imageBatchGrid));
  const currentPreviewSheetClamped = Math.min(imagePreviewSheet, totalImagePreviewSheets - 1);
  const currentSheetPhotos = useMemo(() => {
    const start = currentPreviewSheetClamped * imageBatchGrid;
    return imageDocs.slice(start, start + imageBatchGrid);
  }, [currentPreviewSheetClamped, imageBatchGrid, imageDocs]);

  return (
    <div className="space-y-6 pb-6 px-2 sm:px-4">
      <div className="text-center pt-2 pb-4">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">How should we print this?</h2>
        <p className="text-sm font-semibold text-gray-500 bg-gray-100 inline-block px-4 py-1.5 rounded-full shadow-inner">
          {documents.length} {documents.length === 1 ? "file" : "files"} uploaded
        </p>
      </div>

      {pdfDocs.map((doc) => {
        const isExpanded = Boolean(expandedIds[doc.id]);
        return (
          <div
            key={doc.id}
            className={`rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 ${
              isExpanded ? "border-indigo-300 bg-indigo-50/30" : "border-white bg-white/70 backdrop-blur-md"
            }`}
          >
            <div
              onClick={() => toggleExpand(doc.id)}
              className="p-5 flex items-center justify-between cursor-pointer select-none relative overflow-hidden"
            >
              {isExpanded && (
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-300/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              )}
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md">
                    {doc.file.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-md">PDF</span>
                    <span className="text-xs font-bold text-gray-500">
                      {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 flex-shrink-0 z-10 shadow-md ${
                  isExpanded ? "bg-indigo-600 text-white rotate-180" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {isExpanded && (
              <div className="p-4 sm:p-6 pt-2 space-y-8 animate-fade-in relative z-10">
                <div className="space-y-3">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest pl-1">How many copies?</h4>
                  <BigStepper
                    value={doc.settings.copies}
                    onChange={(v) => updateDocSetting(doc.id, "copies", v)}
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest pl-1">Color or B&W?</h4>
                  <BigToggle
                    options={
                      colorAvailable
                        ? [
                            { value: "bw", label: "Black & White", icon: "🎱", sublabel: `₹${rateCard.priceBwPerPage}/page`, activeClasses: "bg-gradient-to-br from-gray-700 to-black text-white" },
                            { value: "color", label: "Color Print", icon: "🌈", sublabel: `₹${rateCard.priceColorPerPage}/page`, activeClasses: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white" },
                          ]
                        : [{ value: "bw", label: "Black & White Only", icon: "🎱", sublabel: `₹${rateCard.priceBwPerPage}/page`, activeClasses: "bg-gradient-to-br from-gray-700 to-black text-white" }]
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
                </div>

                {doc.settings.colorMode !== "color" && (
                  <div className="space-y-3 animate-fade-in-up">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest pl-1">Print on both sides?</h4>
                    <BigToggle
                      options={[
                        { value: "single", label: "1-Sided", icon: "📄", activeClasses: "bg-blue-600 text-white" },
                        { value: "double", label: "2-Sided", icon: "📖", activeClasses: "bg-blue-600 text-white" },
                      ]}
                      value={doc.settings.duplex}
                      onChange={(v) => updateDocSetting(doc.id, "duplex", v as DuplexMode)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {imageDocs.length > 0 && imageBatchSettings && (
        <div className={`rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 ${
          expandedIds["images-batch"] ? "border-pink-300 bg-pink-50/30" : "border-white bg-white/70 backdrop-blur-md"
        }`}>
          <div
            onClick={() => toggleExpand("images-batch")}
            className="p-5 flex items-center justify-between cursor-pointer select-none relative overflow-hidden"
          >
            {expandedIds["images-batch"] && (
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-300/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            )}
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-600 text-white shadow-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md">
                  Photos & Images
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-black text-pink-700 bg-pink-100 px-2 py-0.5 rounded-md">
                    {imageDocs.length} {imageDocs.length === 1 ? "photo" : "photos"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 flex-shrink-0 z-10 shadow-md ${
                expandedIds["images-batch"] ? "bg-pink-600 text-white rotate-180" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {expandedIds["images-batch"] && (
            <div className="p-4 sm:p-6 pt-2 space-y-8 animate-fade-in relative z-10">
              
              {/* Photo Strip */}
              <div className="bg-white/60 p-4 rounded-3xl shadow-inner border border-white">
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest mb-3 pl-1">Your Photos</h4>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {imageDocs.map((img, idx) => (
                    <div key={img.id} className="relative w-16 h-16 rounded-2xl bg-white border border-gray-200 overflow-hidden flex-shrink-0 shadow-sm group">
                      {img.thumbnailUrl ? (
                        <img src={img.thumbnailUrl} alt={img.file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">#{idx + 1}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(img.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-xs hover:bg-red-500 hover:scale-110 transition-all cursor-pointer shadow-md"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest pl-1">How many copies?</h4>
                <BigStepper
                  value={imageBatchSettings.copies}
                  onChange={(v) => updateAllImagesSettings("copies", v)}
                />
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest pl-1">Color or B&W?</h4>
                <BigToggle
                  options={
                    colorAvailable
                      ? [
                          { value: "bw", label: "Black & White", icon: "🎱", sublabel: `₹${rateCard.priceBwPerPage}/page`, activeClasses: "bg-gradient-to-br from-gray-700 to-black text-white" },
                          { value: "color", label: "Color Print", icon: "🌈", sublabel: `₹${rateCard.priceColorPerPage}/page`, activeClasses: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white" },
                        ]
                      : [{ value: "bw", label: "Black & White Only", icon: "🎱", sublabel: `₹${rateCard.priceBwPerPage}/page`, activeClasses: "bg-gradient-to-br from-gray-700 to-black text-white" }]
                  }
                  value={imageBatchSettings.colorMode}
                  onChange={(v) => {
                    const newColor = v as ColorMode;
                    if (newColor === "color") {
                      onDocumentsChange(
                        documents.map((d) => d.type === "image" ? { ...d, settings: { ...d.settings, colorMode: "color", duplex: "single" } } : d)
                      );
                    } else {
                      updateAllImagesSettings("colorMode", newColor);
                    }
                  }}
                />
              </div>

              {/* Grid Selector */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest pl-1">Photos per page</h4>
                <div className="grid grid-cols-5 gap-2 bg-white/60 p-2 rounded-3xl border border-white shadow-inner">
                  {[
                    { value: 1, label: "1" },
                    { value: 2, label: "2" },
                    { value: 4, label: "4" },
                    { value: 6, label: "6" },
                    { value: 9, label: "9" },
                  ].map((g) => {
                    const isSelected = imageBatchGrid === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => {
                          const gridVal = g.value as PagesPerSheet;
                          onDocumentsChange(
                            documents.map((d) => d.type === "image" ? { ...d, settings: { ...d.settings, pagesPerSheet: gridVal, pageFit: gridVal === 1 ? (d.settings.pageFit || "fit") : d.settings.pageFit } } : d)
                          );
                        }}
                        className={`aspect-square rounded-2xl flex items-center justify-center transition-all transform active:scale-90 border-2 ${
                          isSelected ? "bg-pink-500 text-white border-transparent shadow-lg scale-105" : "bg-white text-gray-600 border-gray-100 hover:bg-gray-50 shadow-sm"
                        }`}
                      >
                        <span className="font-black text-xl">{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* Finishing Options */}
      {finishingServices.length > 0 && (
        <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Make it special ✨</h2>
            <p className="text-sm font-semibold text-gray-500 mt-1">Optional finishing add-ons</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {finishingServices.map((service) => {
              const isEnabled = service.enabled;
              return (
                <button
                  key={service.type}
                  type="button"
                  onClick={() => toggleFinishing(service.type)}
                  className={`relative p-5 rounded-3xl flex items-center justify-between gap-4 transition-all duration-300 transform active:scale-95 border-2 text-left ${
                    isEnabled
                      ? "shadow-2xl border-transparent scale-105 bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                      : "bg-white/80 hover:bg-white text-gray-700 shadow-md border-gray-100 hover:-translate-y-1"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      isEnabled ? "border-white bg-white/20 text-white" : "border-gray-300 bg-gray-50 text-transparent"
                    }`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-extrabold text-lg block">{service.label}</span>
                      <span className={`text-xs font-bold ${isEnabled ? "text-emerald-100" : "text-gray-400"}`}>
                        +₹{service.price} {service.chargeUnit === "per_sheet" ? "/ page" : "/ set"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
