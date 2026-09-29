"use client";

import React, { useMemo } from "react";
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
    <div className="inline-flex p-1 rounded-xl bg-zinc-100 border border-zinc-200/80 shadow-inner">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${
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
        className="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 text-zinc-900 font-bold transition flex items-center justify-center text-sm shadow-sm active:scale-95"
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
        className="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 text-zinc-900 font-bold transition flex items-center justify-center text-sm shadow-sm active:scale-95"
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
  // Applies a setting change to all documents
  const updateAllSettings = (key: keyof PrintSettings, value: unknown) => {
    onDocumentsChange(
      documents.map((doc) => ({
        ...doc,
        settings: { ...doc.settings, [key]: value },
      }))
    );
  };

  // Applies a setting change to one document
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

  const toggleFinishing = (type: string) => {
    onFinishingChange(
      finishingServices.map((s) =>
        s.type === type ? { ...s, enabled: !s.enabled } : s
      )
    );
  };

  // First document acts as global settings source
  const globalSettings = documents[0]?.settings;
  if (!globalSettings) return null;

  return (
    <div className="space-y-4 pb-28 animate-fade-in-up">
      {/* ── Global Settings Card ── */}
      <div className="glass rounded-2xl p-5 glow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Print Specifications</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Applied to all documents in this order</p>
          </div>
          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
            {documents.length} document{documents.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Color Mode */}
        <SettingRow
          label="Color Reproduction"
          description={
            colorAvailable
              ? "Standard B&W or high-res full color"
              : "Color currently unavailable at this counter"
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
            value={globalSettings.colorMode}
            onChange={(v) => updateAllSettings("colorMode", v as ColorMode)}
          />
        </SettingRow>

        {/* Copies */}
        <SettingRow label="Number of Copies" description="Total identical sets to print">
          <CopiesStepper
            value={globalSettings.copies}
            onChange={(v) => updateAllSettings("copies", v)}
          />
        </SettingRow>

        {/* Duplex / Sides */}
        <SettingRow label="Paper Sides" description="Single-sided or back-to-back">
          <SegmentedToggle
            options={[
              { value: "single", label: "Single Sided" },
              { value: "double", label: "Duplex (2-sided)" },
            ]}
            value={globalSettings.duplex}
            onChange={(v) => updateAllSettings("duplex", v as DuplexMode)}
          />
        </SettingRow>

        {/* Pages Per Sheet */}
        <SettingRow label="Page Layout" description="Combine multiple pages per paper sheet">
          <SegmentedToggle
            options={[
              { value: "1", label: "1 per sheet" },
              { value: "2", label: "2-in-1" },
              { value: "4", label: "4-in-1" },
            ]}
            value={String(globalSettings.pagesPerSheet)}
            onChange={(v) =>
              updateAllSettings("pagesPerSheet", Number(v) as PagesPerSheet)
            }
          />
        </SettingRow>

        {/* Orientation */}
        <SettingRow label="Sheet Orientation" description="Automatic or forced rotation">
          <SegmentedToggle
            options={[
              { value: "portrait", label: "Portrait ▯" },
              { value: "landscape", label: "Landscape ▭" },
            ]}
            value={globalSettings.orientation}
            onChange={(v) =>
              updateAllSettings("orientation", v as "portrait" | "landscape")
            }
          />
        </SettingRow>
      </div>

      {/* ── Per-Document Overrides (only shown if multiple files) ── */}
      {documents.length > 1 && (
        <div className="glass rounded-2xl p-5 glow-sm">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-3">
            Individual File Adjustments
          </h3>
          <div className="space-y-2.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl bg-zinc-50 border border-zinc-200/70 p-3"
              >
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-zinc-900 truncate max-w-[65%]">
                    {doc.file.name}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {doc.pageCount} page{doc.pageCount > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500">Copies:</span>
                    <CopiesStepper
                      value={doc.settings.copies}
                      onChange={(v) => updateDocSetting(doc.id, "copies", v)}
                    />
                  </div>
                  <SegmentedToggle
                    options={[
                      { value: "bw", label: "B&W" },
                      { value: "color", label: "Color" },
                    ]}
                    value={doc.settings.colorMode}
                    onChange={(v) =>
                      updateDocSetting(doc.id, "colorMode", v as ColorMode)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Finishing Add-ons ── */}
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
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border text-left ${
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
