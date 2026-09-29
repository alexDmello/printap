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
import {
  calculateDocumentPrice,
  calculateFinishingCost,
  calculateOrderTotal,
} from "@printap/shared";

// ─── Sub-components ───

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[--color-border] last:border-b-0">
      <span className="text-sm text-[--color-muted]">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function TogglePill({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-[--color-border]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-all ${
            value === opt.value
              ? "bg-[--color-accent] text-white"
              : "bg-[--color-surface-light] text-[--color-muted] hover:text-[--color-foreground]"
          }`}
        >
          {opt.label}
        </button>
      ))}
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
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-7 h-7 rounded-lg bg-[--color-surface-light] hover:bg-[--color-border] transition flex items-center justify-center text-sm"
      >
        −
      </button>
      <span className="w-6 text-center font-mono font-semibold text-sm">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(50, value + 1))}
        className="w-7 h-7 rounded-lg bg-[--color-surface-light] hover:bg-[--color-border] transition flex items-center justify-center text-sm"
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
  onContinue: () => void;
  onBack: () => void;
}

export default function PrintSettingsPanel({
  documents,
  onDocumentsChange,
  rateCard,
  finishingServices,
  onFinishingChange,
  onContinue,
  onBack,
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

  const activeFinishing = finishingServices.filter((s) => s.enabled);

  // Use first document's settings as the "global" display
  const globalSettings = documents[0]?.settings;

  const totalPrice = useMemo(
    () => calculateOrderTotal(documents, rateCard, activeFinishing),
    [documents, rateCard, activeFinishing]
  );

  const toggleFinishing = (type: string) => {
    onFinishingChange(
      finishingServices.map((s) =>
        s.type === type ? { ...s, enabled: !s.enabled } : s
      )
    );
  };

  if (!globalSettings) return null;

  return (
    <div className="animate-fade-in-up space-y-4">
      {/* ── Global Settings Card ── */}
      <div className="glass rounded-2xl p-5 glow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Print Settings</h2>
          <span className="text-[11px] text-[--color-muted] bg-[--color-surface-light] px-2 py-1 rounded-md">
            Applied to all files
          </span>
        </div>

        {/* Color Mode */}
        <SettingRow label="Color">
          <TogglePill
            options={[
              { value: "bw", label: `B&W · ₹${rateCard.priceBwPerPage}` },
              { value: "color", label: `Color · ₹${rateCard.priceColorPerPage}` },
            ]}
            value={globalSettings.colorMode}
            onChange={(v) => updateAllSettings("colorMode", v as ColorMode)}
          />
        </SettingRow>

        {/* Duplex */}
        <SettingRow label="Sides">
          <TogglePill
            options={[
              { value: "single", label: "Single" },
              { value: "double", label: "Double" },
            ]}
            value={globalSettings.duplex}
            onChange={(v) => updateAllSettings("duplex", v as DuplexMode)}
          />
        </SettingRow>

        {/* Pages Per Sheet */}
        <SettingRow label="Layout">
          <TogglePill
            options={[
              { value: "1", label: "1-in-1" },
              { value: "2", label: "2-in-1" },
              { value: "4", label: "4-in-1" },
            ]}
            value={String(globalSettings.pagesPerSheet)}
            onChange={(v) =>
              updateAllSettings("pagesPerSheet", Number(v) as PagesPerSheet)
            }
          />
        </SettingRow>

        {/* Copies */}
        <SettingRow label="Copies">
          <CopiesStepper
            value={globalSettings.copies}
            onChange={(v) => updateAllSettings("copies", v)}
          />
        </SettingRow>

        {/* Orientation */}
        <SettingRow label="Orientation">
          <TogglePill
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
            value={globalSettings.orientation}
            onChange={(v) => updateAllSettings("orientation", v as "portrait" | "landscape")}
          />
        </SettingRow>
      </div>

      {/* ── Per-Document Overrides (only shown if multiple files) ── */}
      {documents.length > 1 && (
        <div className="glass rounded-2xl p-5 glow-sm">
          <h3 className="text-sm font-semibold mb-3">Per-File Overrides</h3>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl bg-[--color-surface-light]/50 p-3"
              >
                <p className="text-xs font-medium truncate mb-2">
                  {doc.file.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[--color-muted]">Copies:</span>
                    <CopiesStepper
                      value={doc.settings.copies}
                      onChange={(v) => updateDocSetting(doc.id, "copies", v)}
                    />
                  </div>
                  <TogglePill
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
      <div className="glass rounded-2xl p-5 glow-sm">
        <h3 className="text-sm font-semibold mb-3">Finishing Services</h3>
        <div className="space-y-2">
          {finishingServices.map((service) => (
            <button
              key={service.type}
              onClick={() => toggleFinishing(service.type)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                service.enabled
                  ? "bg-[--color-accent]/10 border border-[--color-accent]/30"
                  : "bg-[--color-surface-light]/50 border border-transparent hover:border-[--color-border]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    service.enabled
                      ? "border-[--color-accent] bg-[--color-accent]"
                      : "border-[--color-border]"
                  }`}
                >
                  {service.enabled && (
                    <svg
                      className="w-3 h-3 text-white"
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
                <span className="text-sm font-medium">{service.label}</span>
              </div>
              <span className="text-xs text-[--color-muted]">
                ₹{service.price}/{service.chargeUnit === "per_sheet" ? "sheet" : "copy"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Price Summary ── */}
      <div className="glass rounded-2xl p-5 glow-sm">
        <h3 className="text-sm font-semibold mb-3">Price Breakdown</h3>
        <div className="space-y-2">
          {documents.map((doc) => {
            const printCost = calculateDocumentPrice(doc, rateCard);
            const finCost = calculateFinishingCost(doc, activeFinishing);
            return (
              <div key={doc.id} className="flex items-center justify-between text-xs">
                <span className="text-[--color-muted] truncate max-w-[60%]">
                  {doc.file.name}
                </span>
                <span className="font-mono">₹{printCost + finCost}</span>
              </div>
            );
          })}
          {activeFinishing.length > 0 && (
            <div className="border-t border-[--color-border] pt-2 mt-2">
              {activeFinishing.map((s) => (
                <div key={s.type} className="flex items-center justify-between text-xs text-[--color-accent-light]">
                  <span>+ {s.label}</span>
                  <span className="font-mono">included above</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-[--color-border]">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-bold text-[--color-success]">
              ₹{totalPrice}
            </span>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-[--color-surface-light] hover:bg-[--color-border] text-sm font-medium transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          className="flex-[2] btn-primary py-3 rounded-xl font-semibold text-white text-sm tracking-wide"
        >
          Proceed to Payment →
        </button>
      </div>
    </div>
  );
}
