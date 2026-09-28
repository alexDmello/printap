"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  sendFileToShop,
  type TransferProgress,
} from "@/lib/customer-signaling";

interface Props {
  shopId: string;
  shopName: string;
  upiVpa: string;
}

type Step = "upload" | "pay" | "transferring" | "done" | "error";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "pay", label: "Pay" },
  { key: "transferring", label: "Transfer" },
  { key: "done", label: "Done" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PrintClient({ shopId, shopName, upiVpa }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [copies, setCopies] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const amount = copies * 10;

  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(shopName)}&am=${amount.toFixed(2)}&cu=INR&tn=Printap-${shopId.slice(0, 8)}`;

  // Step index for the progress bar
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const isError = step === "error";

  const processFile = useCallback((selected: File) => {
    if (selected.type !== "application/pdf") {
      setErrorMsg("Only PDF files are supported");
      return;
    }
    if (selected.size > 50 * 1024 * 1024) {
      setErrorMsg("Maximum file size is 50 MB");
      return;
    }
    setFile(selected);
    setErrorMsg("");
    setStep("pay");
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) processFile(selected);
    },
    [processFile]
  );

  // Drag & drop support
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) processFile(dropped);
    },
    [processFile]
  );

  const handleStartTransfer = useCallback(async () => {
    if (!file) return;
    const sessionId = crypto.randomUUID();
    setStep("transferring");
    setProgress({ status: "connecting", percent: 0, bytesSent: 0, totalBytes: file.size });

    try {
      await sendFileToShop(shopId, file, sessionId, (p) => {
        setProgress(p);
        if (p.status === "complete") setStep("done");
        else if (p.status === "error") {
          setStep("error");
          setErrorMsg(p.error || "Transfer failed");
        }
      });
    } catch (err) {
      setStep("error");
      setErrorMsg(String(err));
    }
  }, [file, shopId]);

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setProgress(null);
    setErrorMsg("");
    setCopies(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-5 py-8 safe-area-inset">
      {/* ─── Header ─── */}
      <header className="text-center mb-6 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20">
            🖨️
          </div>
          <h1 className="text-2xl font-bold gradient-text tracking-tight">Printap</h1>
        </div>
        <p className="text-sm text-[--color-muted]">
          {shopName}
        </p>
      </header>

      {/* ─── Step Indicator ─── */}
      <nav className="flex items-center gap-2 mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        {STEPS.map((s, i) => {
          const isCurrent = s.key === step || (isError && s.key === "transferring");
          const isComplete = i < stepIndex && !isError;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div
                  className={`h-px w-6 transition-all duration-500 ${
                    isComplete ? "bg-[--color-success]" : "bg-[--color-border]"
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`step-dot w-2.5 h-2.5 rounded-full ${
                    isComplete ? "complete" : isCurrent ? "active" : "bg-[--color-border]"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium tracking-wide uppercase ${
                    isCurrent ? "text-[--color-accent-light]" : isComplete ? "text-[--color-success]" : "text-[--color-muted]"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </nav>

      {/* ─── Main Content ─── */}
      <main className="w-full max-w-sm flex-1 flex flex-col justify-center">

        {/* STEP 1 — Upload */}
        {step === "upload" && (
          <div className="animate-fade-in-up">
            <div className="glass rounded-2xl p-6 glow-sm">
              <h2 className="text-base font-semibold mb-1">Upload your document</h2>
              <p className="text-xs text-[--color-muted] mb-5">PDF files up to 50 MB</p>

              <label
                htmlFor="file-upload"
                className={`drop-zone flex flex-col items-center justify-center w-full h-44 rounded-xl cursor-pointer transition-all ${
                  isDragging
                    ? "border-[--color-accent] bg-[--color-accent]/5 scale-[1.01]"
                    : ""
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-14 h-14 rounded-2xl bg-[--color-accent]/10 flex items-center justify-center mb-3 transition-transform hover:scale-105">
                  <svg className="w-7 h-7 text-[--color-accent-light]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0L8 8m4-4l4 4" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" />
                  </svg>
                </div>
                <span className="text-sm text-[--color-foreground]/70 font-medium">
                  Tap to choose a PDF
                </span>
                <span className="text-[11px] text-[--color-muted] mt-1">
                  or drag and drop here
                </span>
                <input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {errorMsg && (
                <div className="mt-4 flex items-center gap-2 text-[--color-danger] text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Privacy badge */}
            <div className="privacy-badge rounded-xl px-4 py-3 mt-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-400">Zero cloud storage</p>
                <p className="text-[11px] text-[--color-muted]">File goes directly to the printer via encrypted P2P</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Pay */}
        {step === "pay" && file && (
          <div className="animate-fade-in-up space-y-4">
            {/* File info */}
            <div className="glass rounded-2xl p-5 glow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-[--color-muted]">{formatBytes(file.size)}</p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-[--color-muted] hover:text-[--color-foreground] transition p-1"
                  aria-label="Remove file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Copies selector */}
              <div className="flex items-center justify-between py-3 border-t border-[--color-border]">
                <span className="text-sm text-[--color-muted]">Copies</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCopies((c) => Math.max(1, c - 1))}
                    className="w-8 h-8 rounded-lg bg-[--color-surface-light] hover:bg-[--color-border] transition flex items-center justify-center text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-mono font-semibold">{copies}</span>
                  <button
                    onClick={() => setCopies((c) => Math.min(20, c + 1))}
                    className="w-8 h-8 rounded-lg bg-[--color-surface-light] hover:bg-[--color-border] transition flex items-center justify-center text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t border-[--color-border]">
                <span className="text-sm text-[--color-muted]">Total</span>
                <span className="text-xl font-bold text-[--color-success]">₹{amount}</span>
              </div>
            </div>

            {/* UPI QR */}
            <div className="glass rounded-2xl p-5 glow-sm">
              <p className="text-sm font-medium mb-4 text-center">Scan to pay via UPI</p>
              <div className="bg-white rounded-xl p-3 mx-auto w-fit">
                <QRCodeSVG
                  value={upiUrl}
                  size={180}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#111111"
                />
              </div>
              <p className="text-[11px] text-[--color-muted] text-center mt-3">
                Pay to <span className="font-mono text-[--color-foreground]/70">{upiVpa}</span>
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={handleStartTransfer}
              className="btn-primary w-full py-3.5 rounded-xl font-semibold text-white text-sm tracking-wide"
            >
              I've Paid — Send to Printer →
            </button>
          </div>
        )}

        {/* STEP 3 — Transferring */}
        {step === "transferring" && progress && (
          <div className="animate-fade-in-up text-center">
            <div className="glass rounded-2xl p-8 glow-sm animate-pulse-glow">
              {/* Circular progress */}
              <div className="relative w-28 h-28 mx-auto mb-6">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="42"
                    strokeWidth="6" fill="none"
                    className="circular-progress-track"
                  />
                  <circle
                    cx="50" cy="50" r="42"
                    stroke="url(#progressGrad)"
                    strokeWidth="6" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress.percent / 100)}`}
                    className="circular-progress-fill"
                  />
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums">{progress.percent}</span>
                  <span className="text-[10px] text-[--color-muted] -mt-0.5">%</span>
                </div>
              </div>

              <h2 className="text-base font-semibold mb-1">
                {progress.status === "connecting" && "Connecting..."}
                {progress.status === "connected" && "Connected!"}
                {progress.status === "sending" && "Sending to printer"}
              </h2>
              <p className="text-xs text-[--color-muted]">
                {formatBytes(progress.bytesSent)} of {formatBytes(progress.totalBytes)}
              </p>

              {/* Shimmer bar */}
              <div className="mt-5 h-1 rounded-full bg-[--color-border] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-[--color-muted] mt-4">
              ⚡ Encrypted peer-to-peer transfer — no server involved
            </p>
          </div>
        )}

        {/* STEP 4 — Done */}
        {step === "done" && (
          <div className="animate-fade-in-up text-center">
            <div className="glass rounded-2xl p-8 glow-success">
              <div className="animate-checkmark-pop">
                <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <h2 className="text-xl font-bold text-[--color-success] mb-2">
                Sent to Printer!
              </h2>
              <p className="text-sm text-[--color-muted] leading-relaxed">
                Your document is being printed.<br />
                Collect it from the counter.
              </p>

              <div className="mt-6 p-3 rounded-lg bg-[--color-surface-light] text-xs text-[--color-muted]">
                🔥 File was securely shredded from the printer's memory
              </div>

              <button
                onClick={handleReset}
                className="mt-5 px-6 py-2.5 rounded-xl bg-[--color-surface-light] hover:bg-[--color-border] text-sm font-medium transition-all"
              >
                Print another file
              </button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {step === "error" && (
          <div className="animate-fade-in-up text-center">
            <div className="glass rounded-2xl p-8" style={{ borderColor: "rgba(248, 113, 113, 0.15)" }}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
              </div>

              <h2 className="text-lg font-bold text-[--color-danger] mb-2">Transfer Failed</h2>
              <p className="text-sm text-[--color-muted]">{errorMsg}</p>

              <button
                onClick={handleReset}
                className="mt-6 px-6 py-2.5 rounded-xl bg-[--color-surface-light] hover:bg-[--color-border] text-sm font-medium transition-all"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <p className="text-[11px] text-[--color-muted]/60">
          Powered by <span className="gradient-text font-semibold">Printap</span> · Peer-to-peer · Zero data retention
        </p>
      </footer>
    </div>
  );
}
