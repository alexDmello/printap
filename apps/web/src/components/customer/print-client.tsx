"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type {
  UploadedDocument,
  FinishingService,
  ShopRateCard,
  PaymentMethod,
  QueueToken,
  JobStatus,
  ShopServiceItem,
  FinishingChargeUnit,
} from "@printap/shared";
import {
  DEFAULT_RATE_CARD,
  DEFAULT_FINISHING_SERVICES,
  calculateOrderTotal,
  SESSION_STORAGE_KEY,
  getSupabase,
} from "@printap/shared";
import {
  sendOrderToShop,
  type TransferProgress,
} from "@/lib/customer-signaling";

import ShopOffline from "./ShopOffline";

import FileUpload from "./FileUpload";
import PrintSettingsPanel from "./PrintSettings";
import PagePreview from "./PagePreview";
import BottomPriceBar from "./BottomPriceBar";
import Checkout from "./Checkout";
import TransferView from "./TransferView";
import TokenConfirmation from "./TokenConfirmation";
import LiveQueueTracker from "./LiveQueueTracker";
import PickupReady from "./PickupReady";

// ─── Step definitions ───

type Step =
  | "upload"
  | "settings"
  | "preview"
  | "checkout"
  | "transferring"
  | "token"
  | "queue"
  | "pickup"
  | "error";

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "settings", label: "Settings" },
  { key: "preview", label: "Preview" },
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
  /** Optional rate card from database */
  priceBw?: number;
  priceColor?: number;
  /** Optional shop custom services */
  services?: ShopServiceItem[];
  initialIsOnline?: boolean;
}

function generateTokenCode(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const num = Math.floor(Math.random() * 50) + 1;
  return `${letter}-${num}`;
}

function generatePickupPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function PrintClient({
  shopId,
  shopName,
  upiVpa,
  priceBw,
  priceColor,
  services,
  initialIsOnline = false,
}: Props) {
  // ─── State ───
  const [step, setStep] = useState<Step>("upload");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  // Initialize finishing services from shop custom services if available
  const initialFinishing = useMemo<FinishingService[]>(() => {
    if (services && services.length > 0) {
      const customOnes = services
        .filter((s) => !s.isCore && s.enabled)
        .map((s) => ({
          type: s.id,
          label: s.name,
          price: s.price,
          chargeUnit: (s.unit === "per_sheet" ? "per_sheet" : "per_copy") as FinishingChargeUnit,
          enabled: false,
        }));
      if (customOnes.length > 0) return customOnes;
    }
    return [...DEFAULT_FINISHING_SERVICES];
  }, [services]);

  const [finishingServices, setFinishingServices] = useState<FinishingService[]>(initialFinishing);

  // Sync if services prop updates
  useEffect(() => {
    setFinishingServices(initialFinishing);
  }, [initialFinishing]);

  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [token, setToken] = useState<QueueToken | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("queued");
  const [isShopOnline, setIsShopOnline] = useState<boolean>(initialIsOnline);

  // Monitor shop online status in realtime and verify on mount
  useEffect(() => {
    if (!shopId) return;

    let isMounted = true;
    const supabase = getSupabase();

    // 1. Immediately verify latest status from DB
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("shops")
          .select("is_online")
          .eq("id", shopId)
          .maybeSingle();

        if (!error && data && isMounted) {
          setIsShopOnline(Boolean(data.is_online));
        }
      } catch (err) {
        console.warn("[PrintClient] Status check error:", err);
      }
    };

    checkStatus();

    // 2. Subscribe to updates on shops table with a unique channel name
    const channelId = `customer-shop-${shopId}-${Math.random().toString(36).substring(2, 9)}`;
    const dbChannel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "shops",
          filter: `id=eq.${shopId}`,
        },
        (payload) => {
          if (
            payload.new &&
            typeof (payload.new as { is_online?: boolean }).is_online ===
              "boolean" &&
            isMounted
          ) {
            const online = (payload.new as { is_online: boolean }).is_online;
            console.log(`[PrintClient] Realtime status update: is_online = ${online}`);
            setIsShopOnline(online);
          }
        }
      )
      .subscribe();

    // 3. Fallback polling every 5 seconds to ensure fail-safe synchronization
    const pollInterval = setInterval(checkStatus, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      try {
        supabase.removeChannel(dbChannel);
      } catch (e) {
        console.warn("[PrintClient] Cleanup error:", e);
      }
    };
  }, [shopId]);

  // Determine if color printing is enabled by the shop
  const colorAvailable = useMemo(() => {
    if (!services || services.length === 0) return true;
    const colorService = services.find((s) => s.id === "core_color");
    return colorService ? colorService.enabled : true;
  }, [services]);

  // Rate card from props or defaults
  const rateCard: ShopRateCard = {
    priceBwPerPage: priceBw ?? DEFAULT_RATE_CARD.priceBwPerPage,
    priceColorPerPage: priceColor ?? DEFAULT_RATE_CARD.priceColorPerPage,
    finishingServices,
  };

  const activeFinishing = finishingServices.filter((s) => s.enabled);
  const totalAmount = calculateOrderTotal(documents, rateCard, activeFinishing);

  // Total sheets calculated
  const totalSheets = useMemo(() => {
    return documents.reduce((sum, doc) => {
      const sheetsPerSet = Math.ceil(doc.pageCount / doc.settings.pagesPerSheet);
      return sum + sheetsPerSet * doc.settings.copies;
    }, 0);
  }, [documents]);

  const globalColorMode = documents[0]?.settings.colorMode || "bw";

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
          setStep(session.status === "ready_for_pickup" ? "pickup" : "queue");
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
    setFinishingServices([...initialFinishing]);
    setProgress(null);
    setErrorMsg("");
    setToken(null);
    setJobStatus("queued");
    localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
  }, [shopId, initialFinishing]);

  const handleJobStatusChange = useCallback(
    (status: JobStatus) => {
      setJobStatus(status);
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

  // If the shop goes offline and there is no active transfer/order in flight, show offline screen
  const isOrderActive = ["transferring", "token", "queue", "pickup"].includes(
    step
  );
  if (!isShopOnline && !isOrderActive) {
    return (
      <ShopOffline
        shopId={shopId}
        shopName={shopName}
        onGoOnline={() => setIsShopOnline(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900 flex flex-col items-center justify-between px-4 py-6 sm:px-6 safe-area-inset relative">
      {/* ─── Header ─── */}
      <header className="text-center mb-5 animate-fade-in-up w-full max-w-md">
        <div className="inline-flex items-center gap-2 mb-1.5">
          <img
            src="/logo.png"
            alt="Printap"
            className="w-8 h-8 rounded-xl object-cover shadow-sm border border-black/10"
          />
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
            Printap
          </h1>
        </div>
        <p className="text-xs font-semibold text-zinc-500">
          Counter Terminal • <span className="text-zinc-900 font-bold">{shopName}</span>
        </p>
      </header>

      {/* ─── Step Indicator ─── */}
      <nav
        className="flex items-center gap-1.5 mb-6 animate-fade-in-up overflow-x-auto max-w-full px-2"
        style={{ animationDelay: "0.05s" }}
      >
        {STEP_LABELS.map((s, i) => {
          const isCurrent =
            s.key === step || (isError && s.key === "transferring");
          const isComplete = i < stepIndex && !isError;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div
                  className={`h-0.5 w-3 sm:w-4 transition-all duration-300 flex-shrink-0 ${
                    isComplete ? "bg-emerald-500" : "bg-zinc-200"
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    isComplete
                      ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                      : isCurrent
                      ? "bg-zinc-900 ring-4 ring-zinc-900/15"
                      : "bg-zinc-300"
                  }`}
                />
                <span
                  className={`text-[9px] font-bold tracking-wider uppercase ${
                    isCurrent
                      ? "text-zinc-900"
                      : isComplete
                      ? "text-emerald-600"
                      : "text-zinc-400"
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
      <main className="w-full max-w-md flex-1 flex flex-col justify-center">
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
            colorAvailable={colorAvailable}
          />
        )}

        {/* STEP 3 — Interactive Preview */}
        {step === "preview" && (
          <PagePreview
            documents={documents}
            rateCard={rateCard}
            finishingServices={finishingServices}
            onBack={() => setStep("settings")}
            onContinue={() => setStep("checkout")}
          />
        )}

        {/* STEP 4 — Checkout & Payment */}
        {step === "checkout" && (
          <div className="pb-28">
            <Checkout
              shopName={shopName}
              shopId={shopId}
              upiVpa={upiVpa}
              totalAmount={totalAmount}
              onPaymentConfirmed={handlePaymentConfirmed}
              onBack={() => setStep("preview")}
            />
          </div>
        )}

        {/* STEP 5 — Transferring */}
        {step === "transferring" && progress && (
          <TransferView
            progress={progress}
            fileCount={documents.length}
          />
        )}

        {/* STEP 6 — Token Confirmation */}
        {step === "token" && token && (
          <TokenConfirmation
            token={token}
            onContinue={() => setStep("queue")}
          />
        )}

        {/* STEP 7 — Live Queue Tracker */}
        {step === "queue" && token && (
          <LiveQueueTracker
            token={token}
            jobStatus={jobStatus}
            onStatusChange={handleJobStatusChange}
            onPickupReady={() => setStep("pickup")}
          />
        )}

        {/* STEP 8 — Pickup Ready */}
        {step === "pickup" && token && (
          <PickupReady
            token={token}
            onPrintAnother={handleReset}
          />
        )}

        {/* ERROR STATE */}
        {step === "error" && (
          <div className="animate-fade-in-up text-center">
            <div className="glass rounded-2xl p-8 border border-red-200 shadow-xl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold">
                ✕
              </div>
              <h2 className="text-lg font-bold text-zinc-900 mb-2">
                Transfer Interrupted
              </h2>
              <p className="text-xs text-zinc-600">{errorMsg}</p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-6 px-6 py-2.5 rounded-xl btn-primary text-xs font-bold text-white shadow"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ─── Persistent Bottom Price Bar from Settings Onwards ─── */}
      {step === "settings" && (
        <BottomPriceBar
          totalPrice={totalAmount}
          documentCount={documents.length}
          totalSheets={totalSheets}
          colorMode={globalColorMode}
          activeFinishingCount={activeFinishing.length}
          activeFinishingLabels={activeFinishing.map((s) => s.label)}
          buttonLabel="View Preview →"
          onContinue={() => setStep("preview")}
          onBack={() => setStep("upload")}
        />
      )}

      {step === "preview" && (
        <BottomPriceBar
          totalPrice={totalAmount}
          documentCount={documents.length}
          totalSheets={totalSheets}
          colorMode={globalColorMode}
          activeFinishingCount={activeFinishing.length}
          activeFinishingLabels={activeFinishing.map((s) => s.label)}
          buttonLabel="Proceed to Payment →"
          onContinue={() => setStep("checkout")}
          onBack={() => setStep("settings")}
        />
      )}

      {/* ─── Footer ─── */}
      <footer
        className="mt-6 text-center animate-fade-in-up"
        style={{ animationDelay: "0.2s" }}
      >
        <p className="text-[11px] text-zinc-400">
          Powered by <span className="font-bold text-zinc-700">Printap</span> ·
          Direct Device-to-Printer · Zero Cloud Storage
        </p>
      </footer>
    </div>
  );
}
