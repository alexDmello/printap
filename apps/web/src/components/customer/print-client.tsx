"use client";

import React, { useState, useCallback, useEffect } from "react";
import type {
  UploadedDocument,
  FinishingService,
  ShopRateCard,
  PaymentMethod,
  QueueToken,
  JobStatus,
} from "@printap/shared";
import {
  DEFAULT_RATE_CARD,
  DEFAULT_FINISHING_SERVICES,
  calculateOrderTotal,
  SESSION_STORAGE_KEY,
} from "@printap/shared";
import {
  sendOrderToShop,
  type TransferProgress,
} from "@/lib/customer-signaling";

import FileUpload from "./FileUpload";
import PrintSettingsPanel from "./PrintSettings";
import Checkout from "./Checkout";
import TransferView from "./TransferView";
import TokenConfirmation from "./TokenConfirmation";
import LiveQueueTracker from "./LiveQueueTracker";
import PickupReady from "./PickupReady";

// ─── Step definitions ───

type Step =
  | "upload"
  | "settings"
  | "checkout"
  | "transferring"
  | "token"
  | "queue"
  | "pickup"
  | "error";

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "settings", label: "Settings" },
  { key: "checkout", label: "Pay" },
  { key: "transferring", label: "Transfer" },
  { key: "token", label: "Token" },
  { key: "queue", label: "Queue" },
  { key: "pickup", label: "Pickup" },
];

interface Props {
  shopId: string;
  shopName: string;
  upiVpa: string;
  /** Optional rate card from database; falls back to defaults */
  priceBw?: number;
  priceColor?: number;
}

/**
 * Generates a token code like "A-14"
 */
function generateTokenCode(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const num = Math.floor(Math.random() * 50) + 1;
  return `${letter}-${num}`;
}

/**
 * Generates a 4-digit PIN
 */
function generatePickupPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function PrintClient({
  shopId,
  shopName,
  upiVpa,
  priceBw,
  priceColor,
}: Props) {
  // ─── State ───
  const [step, setStep] = useState<Step>("upload");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [finishingServices, setFinishingServices] = useState<FinishingService[]>(
    [...DEFAULT_FINISHING_SERVICES]
  );
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [token, setToken] = useState<QueueToken | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("queued");

  // Build rate card from props or defaults
  const rateCard: ShopRateCard = {
    priceBwPerPage: priceBw ?? DEFAULT_RATE_CARD.priceBwPerPage,
    priceColorPerPage: priceColor ?? DEFAULT_RATE_CARD.priceColorPerPage,
    finishingServices,
  };

  const activeFinishing = finishingServices.filter((s) => s.enabled);

  const totalAmount = calculateOrderTotal(documents, rateCard, activeFinishing);

  // Step index for progress bar
  const stepIndex = STEP_LABELS.findIndex((s) => s.key === step);
  const isError = step === "error";

  // ─── Session Recovery ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY(shopId));
      if (saved) {
        const session = JSON.parse(saved);
        if (session.token && session.status !== "picked_up") {
          setToken(session.token);
          setJobStatus(session.status);
          setStep(
            session.status === "ready_for_pickup" ? "pickup" : "queue"
          );
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [shopId]);

  // ─── Persist session when token is set ───
  useEffect(() => {
    if (token) {
      localStorage.setItem(
        SESSION_STORAGE_KEY(shopId),
        JSON.stringify({
          orderId: crypto.randomUUID(),
          shopId,
          token,
          status: jobStatus,
          createdAt: new Date().toISOString(),
        })
      );
    }
  }, [token, jobStatus, shopId]);

  // ─── Handlers ───

  const handlePaymentConfirmed = useCallback(
    async (method: PaymentMethod) => {
      if (documents.length === 0) return;

      const sessionId = crypto.randomUUID();
      const newToken: QueueToken = {
        tokenCode: generateTokenCode(),
        pickupPin: generatePickupPin(),
        queuePosition: Math.floor(Math.random() * 5) + 1,
        estimatedWaitMinutes: Math.floor(Math.random() * 8) + 2,
      };

      setToken(newToken);
      setStep("transferring");

      const totalBytes = documents.reduce((acc, d) => acc + d.file.size, 0);
      setProgress({
        status: "connecting",
        percent: 0,
        bytesSent: 0,
        totalBytes,
        totalFiles: documents.length,
        currentFileIndex: 1,
        currentFileName: documents[0]?.file.name,
      });

      try {
        await sendOrderToShop(
          {
            shopId,
            sessionId,
            documents,
            token: newToken,
            paymentMethod: method,
            paymentStatus:
              method === "cash" ? "awaiting_cash_confirmation" : "confirmed",
            totalAmount,
            finishingServices: activeFinishing,
          },
          (p) => {
            setProgress(p);
            if (p.status === "complete") {
              setJobStatus("queued");
              setStep("token");
            } else if (p.status === "error") {
              setStep("error");
              setErrorMsg(p.error || "Transfer failed");
            }
          }
        );
      } catch (err) {
        setStep("error");
        setErrorMsg(String(err));
      }
    },
    [documents, shopId, totalAmount, activeFinishing]
  );

  const handleReset = useCallback(() => {
    setStep("upload");
    setDocuments([]);
    setFinishingServices([...DEFAULT_FINISHING_SERVICES]);
    setProgress(null);
    setErrorMsg("");
    setToken(null);
    setJobStatus("queued");
    localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
  }, [shopId]);

  const handleJobStatusChange = useCallback(
    (status: JobStatus) => {
      setJobStatus(status);
      // Update persisted session
      if (token) {
        localStorage.setItem(
          SESSION_STORAGE_KEY(shopId),
          JSON.stringify({
            orderId: crypto.randomUUID(),
            shopId,
            token,
            status,
            createdAt: new Date().toISOString(),
          })
        );
      }
    },
    [shopId, token]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-5 py-8 safe-area-inset">
      {/* ─── Header ─── */}
      <header className="text-center mb-6 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20">
            🖨️
          </div>
          <h1 className="text-2xl font-bold gradient-text tracking-tight">
            Printap
          </h1>
        </div>
        <p className="text-sm text-[--color-muted]">{shopName}</p>
      </header>

      {/* ─── Step Indicator ─── */}
      <nav
        className="flex items-center gap-1.5 mb-8 animate-fade-in-up overflow-x-auto max-w-full px-2"
        style={{ animationDelay: "0.1s" }}
      >
        {STEP_LABELS.map((s, i) => {
          const isCurrent =
            s.key === step || (isError && s.key === "transferring");
          const isComplete = i < stepIndex && !isError;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div
                  className={`h-px w-4 transition-all duration-500 flex-shrink-0 ${
                    isComplete ? "bg-[--color-success]" : "bg-[--color-border]"
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={`step-dot w-2 h-2 rounded-full ${
                    isComplete
                      ? "complete"
                      : isCurrent
                      ? "active"
                      : "bg-[--color-border]"
                  }`}
                />
                <span
                  className={`text-[9px] font-medium tracking-wide uppercase ${
                    isCurrent
                      ? "text-[--color-accent-light]"
                      : isComplete
                      ? "text-[--color-success]"
                      : "text-[--color-muted]"
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
          <FileUpload
            documents={documents}
            onDocumentsChange={setDocuments}
            onContinue={() => setStep("settings")}
            errorMsg={errorMsg}
            onError={setErrorMsg}
          />
        )}

        {/* STEP 2 — Print Settings */}
        {step === "settings" && (
          <PrintSettingsPanel
            documents={documents}
            onDocumentsChange={setDocuments}
            rateCard={rateCard}
            finishingServices={finishingServices}
            onFinishingChange={setFinishingServices}
            onContinue={() => setStep("checkout")}
            onBack={() => setStep("upload")}
          />
        )}

        {/* STEP 3 — Checkout & Payment */}
        {step === "checkout" && (
          <Checkout
            shopName={shopName}
            shopId={shopId}
            upiVpa={upiVpa}
            totalAmount={totalAmount}
            onPaymentConfirmed={handlePaymentConfirmed}
            onBack={() => setStep("settings")}
          />
        )}

        {/* STEP 4 — Transferring */}
        {step === "transferring" && progress && (
          <TransferView
            progress={progress}
            fileCount={documents.length}
          />
        )}

        {/* STEP 5 — Token Confirmation */}
        {step === "token" && token && (
          <TokenConfirmation
            token={token}
            onContinue={() => setStep("queue")}
          />
        )}

        {/* STEP 6 — Live Queue Tracker */}
        {step === "queue" && token && (
          <LiveQueueTracker
            token={token}
            jobStatus={jobStatus}
            onStatusChange={handleJobStatusChange}
            onPickupReady={() => setStep("pickup")}
          />
        )}

        {/* STEP 7 — Pickup Ready */}
        {step === "pickup" && token && (
          <PickupReady
            token={token}
            onPrintAnother={handleReset}
          />
        )}

        {/* ERROR */}
        {step === "error" && (
          <div className="animate-fade-in-up text-center">
            <div
              className="glass rounded-2xl p-8"
              style={{ borderColor: "rgba(248, 113, 113, 0.15)" }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[--color-danger] mb-2">
                Transfer Failed
              </h2>
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
      <footer
        className="mt-8 text-center animate-fade-in-up"
        style={{ animationDelay: "0.2s" }}
      >
        <p className="text-[11px] text-[--color-muted]/60">
          Powered by{" "}
          <span className="gradient-text font-semibold">Printap</span> ·
          Peer-to-peer · Zero data retention
        </p>
      </footer>
    </div>
  );
}
