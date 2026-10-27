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
  calculateOrderSheets,
  SESSION_STORAGE_KEY,
  isOrderCompleted,
  isOrderFailed,
  getSupabase,
  joinSignalingChannel,
  broadcast,
} from "@printap/shared";
import type { PersistedSession, SignalPayload } from "@printap/shared";
import {
  sendOrderToShop,
  requestTokenFromShop,
  type TransferProgress,
} from "@/lib/customer-signaling";

import ShopOffline from "./ShopOffline";

import FileUpload from "./FileUpload";
import PrintSettingsPanel from "./PrintSettings";
import PagePreview from "./PagePreview";
import BottomPriceBar from "./BottomPriceBar";
import PrintAndPay from "./PrintAndPay";

// ─── Step definitions ───

type Step =
  | "upload"
  | "settings"
  | "preview"
  | "print_pay"
  | "error";

const MILESTONE_STEPS = [
  { key: "upload", label: "Upload" },
  { key: "settings", label: "Settings" },
  { key: "preview", label: "Preview" },
  { key: "print_pay", label: "Print & Pay" },
] as const;

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
  platformFee?: number;
  gstPercentage?: number;
  gstAmount?: number;
  totalCharge?: number;
}

export default function PrintClient({
  shopId,
  shopName,
  upiVpa,
  priceBw,
  priceColor,
  services,
  initialIsOnline = false,
  platformFee,
  gstPercentage,
  gstAmount,
  totalCharge,
}: Props) {
  // ─── State ───
  const [step, setStep] = useState<Step>("upload");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Automatically scroll to the top of the page on every step change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  // Initialize finishing services from shop custom services if available
  const initialFinishing = useMemo<FinishingService[]>(() => {
    if (services !== undefined) {
      return services
        .filter((s) => !s.isCore && s.enabled)
        .map((s) => ({
          type: s.id,
          label: s.name,
          price: s.price,
          chargeUnit: (s.unit === "per_sheet" ? "per_sheet" : "per_copy") as FinishingChargeUnit,
          enabled: false,
        }));
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
  const [isShopOnline, setIsShopOnline] = useState<boolean>(initialIsOnline);

  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [token, setToken] = useState<QueueToken | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("queued");
  const [isPaymentConfirmedByShop, setIsPaymentConfirmedByShop] = useState(false);
  const [isRefundPromptOpen, setIsRefundPromptOpen] = useState(false);
  const [printTicket, setPrintTicket] = useState<string>("");
  const [persistedTotalAmount, setPersistedTotalAmount] = useState<number>(0);
  const [persistedDocumentCount, setPersistedDocumentCount] = useState<number>(0);
  
  // Try to restore session on mount
  useEffect(() => {
    let isMounted = true;
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY(shopId));
      if (saved) {
        const parsed = JSON.parse(saved) as PersistedSession;
        if (!isOrderCompleted(parsed.status) && !isOrderFailed(parsed.status)) {
          setCurrentSessionId(parsed.orderId);
          setToken(parsed.token);
          setJobStatus(parsed.status);
          if (parsed.printTicket) setPrintTicket(parsed.printTicket);
          if (parsed.isPaymentConfirmed || parsed.status === "ready_for_pickup") {
            setIsPaymentConfirmedByShop(true);
          }
          if (parsed.totalAmount !== undefined) setPersistedTotalAmount(parsed.totalAmount);
          if (parsed.documentCount !== undefined) setPersistedDocumentCount(parsed.documentCount);
          setStep("print_pay"); // Resume straight to print progress screen

          // Immediately verify live status with Supabase in case order status changed while offline
          (async () => {
            try {
              const supabase = getSupabase();
              const { data } = await supabase
                .from("print_orders")
                .select("status, payment_status, token_code")
                .eq("session_id", parsed.orderId)
                .maybeSingle();

              if (!isMounted || !data) return;
              if (data.token_code) {
                setToken((prev) => (prev ? { ...prev, tokenCode: data.token_code! } : prev));
              }
              if (data.payment_status === "confirmed") {
                setIsPaymentConfirmedByShop(true);
              }
              const liveStatus = data.status;
              if (isOrderCompleted(liveStatus)) {
                try {
                  localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
                } catch {}
                setJobStatus("picked_up");
              } else if (isOrderFailed(liveStatus)) {
                try {
                  localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
                } catch {}
                setStep("error");
                setErrorMsg(
                  liveStatus === "cancelled"
                    ? "Your order was cancelled by the shop."
                    : "Hardware print spooler reported an error. The shopkeeper can retry your print at the counter."
                );
                if (liveStatus === "failed" || liveStatus === "failed_refunded") {
                  setIsRefundPromptOpen(true);
                }
              } else if (liveStatus) {
                setJobStatus(liveStatus as JobStatus);
              }
            } catch (err) {
              console.warn("[PrintClient] Live status check on restore error:", err);
            }
          })();
        } else {
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
          } catch {}
        }
      }
    } catch (e) {
      console.warn("[PrintClient] Failed to load persisted session", e);
    }

    return () => {
      isMounted = false;
    };
  }, [shopId]);

  // Persist session automatically while active; end immediately once completed or failed
  useEffect(() => {
    const isCompleted = isOrderCompleted(jobStatus);
    const isFailed = isOrderFailed(jobStatus) || step === "error";

    if (isCompleted || isFailed || step === "upload") {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
      } catch {}
      return;
    }

    if (currentSessionId && token && step === "print_pay") {
      const persisted: PersistedSession = {
        orderId: currentSessionId,
        shopId,
        token,
        status: jobStatus,
        createdAt: new Date().toISOString(),
        totalAmount: documents.length > 0 ? (calculateOrderTotal(documents, {
            priceBwPerPage: priceBw ?? DEFAULT_RATE_CARD.priceBwPerPage,
            priceColorPerPage: priceColor ?? DEFAULT_RATE_CARD.priceColorPerPage,
            finishingServices,
          }, finishingServices.filter((s) => s.enabled)) + (totalCharge !== undefined ? totalCharge : Math.round(((platformFee !== undefined ? platformFee : 0.82) + (gstAmount !== undefined ? gstAmount : Math.round((platformFee !== undefined ? platformFee : 0.82) * ((gstPercentage !== undefined ? gstPercentage : 18) / 100) * 100) / 100)) * 100) / 100)) : persistedTotalAmount,
        documentCount: documents.length > 0 ? documents.length : persistedDocumentCount,
        printTicket,
        isPaymentConfirmed: isPaymentConfirmedByShop,
      };
      try {
        localStorage.setItem(SESSION_STORAGE_KEY(shopId), JSON.stringify(persisted));
      } catch {}
    }
  }, [
    currentSessionId,
    token,
    jobStatus,
    step,
    shopId,
    documents,
    priceBw,
    priceColor,
    finishingServices,
    totalCharge,
    platformFee,
    gstAmount,
    gstPercentage,
    persistedTotalAmount,
    persistedDocumentCount,
    printTicket,
    isPaymentConfirmedByShop,
  ]);

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

    // 2. Pre-warm and subscribe to the shop's signaling channel immediately
    // so token allocation and WebRTC negotiation are instant with zero handshake lag
    joinSignalingChannel(shopId);

    // 3. Subscribe to updates on shops table with a unique channel name
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
  const printingCost = calculateOrderTotal(documents, rateCard, activeFinishing);
  const resolvedPlatformFee = platformFee !== undefined ? platformFee : 0.82;
  const resolvedGstPercentage = gstPercentage !== undefined ? gstPercentage : 18;
  const resolvedGstAmount = gstAmount !== undefined ? gstAmount : Math.round(resolvedPlatformFee * (resolvedGstPercentage / 100) * 100) / 100;
  const resolvedTotalCharge = totalCharge !== undefined ? totalCharge : Math.round((resolvedPlatformFee + resolvedGstAmount) * 100) / 100;
  const totalAmount = documents.length > 0 ? printingCost + resolvedTotalCharge : persistedTotalAmount;
  const activeDocumentCount = documents.length > 0 ? documents.length : persistedDocumentCount;

  // Total sheets calculated
  const totalSheets = useMemo(() => {
    return calculateOrderSheets(documents);
  }, [documents]);

  const globalColorMode = documents[0]?.settings.colorMode || "bw";

  // Active milestone index (0 to 3) for the Top Bar step tracker
  const currentMilestone = useMemo(() => {
    switch (step) {
      case "upload":
        return 0;
      case "settings":
        return 1;
      case "preview":
        return 2;
      case "print_pay":
        return 3;
      default:
        return 0;
    }
  }, [step]);
  const isError = step === "error";

  // Refs to allow broadcast listeners to read latest state without re-subscribing
  const tokenRef = React.useRef(token);
  tokenRef.current = token;
  const sessionIdRef = React.useRef(currentSessionId);
  sessionIdRef.current = currentSessionId;

  // ─── Realtime Payment Confirmation & Order Status Listeners ───
  // IMPORTANT: Subscribe ONCE per shopId — never destroy the channel on
  // token/session changes, or it kills the WebRTC signaling mid-negotiation.
  useEffect(() => {
    if (!shopId) return;

    const channel = joinSignalingChannel(shopId);

    channel.on("broadcast", { event: "payment-confirmed" }, ({ payload }) => {
      console.log("[PrintClient] Broadcast payment-confirmed received:", payload);
      const p = payload as { sessionId?: string; tokenCode?: string };
      const tok = tokenRef.current;
      const sid = sessionIdRef.current;
      if (
        (p.tokenCode && tok && p.tokenCode === tok.tokenCode) ||
        (sid && p.sessionId === sid)
      ) {
        setIsPaymentConfirmedByShop(true);
        setJobStatus("ready_for_pickup");
      }
    });

    channel.on("broadcast", { event: "order-status" }, ({ payload }) => {
      console.log("[PrintClient] Broadcast order-status received:", payload);
      const p = payload as {
        sessionId?: string;
        tokenCode?: string;
        status?: string;
        errorDetail?: string;
      };
      const tok = tokenRef.current;
      const sid = sessionIdRef.current;
      if (
        (sid && p.sessionId === sid) ||
        (tok && p.tokenCode && p.tokenCode === tok.tokenCode)
      ) {
        if (p.tokenCode) {
          setToken((prev) => (prev ? { ...prev, tokenCode: p.tokenCode! } : prev));
        }
        if (p.status === "error") {
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
          } catch {}
          setStep("error");
          setErrorMsg(
            p.errorDetail ||
              "The print could not be completed at the counter. Please retry your print."
          );
          setIsRefundPromptOpen(false);
          return;
        }
        if (p.status === "cancelled") {
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
          } catch {}
          setStep("error");
          setErrorMsg(
            p.errorDetail ||
              "Your order was cancelled by the shop."
          );
          return;
        }
        if (isOrderCompleted(p.status)) {
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
          } catch {}
          setJobStatus("picked_up");
          return;
        }
        if (isOrderFailed(p.status)) {
          try {
            localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
          } catch {}
          setStep("error");
          setErrorMsg(
            p.errorDetail ||
              "The print failed at the counter."
          );
          return;
        }
        if (p.status) {
          setJobStatus(p.status as JobStatus);
          if (p.status === "ready_for_pickup") {
            setIsPaymentConfirmedByShop(true);
          }
        }
      }
    });

    // Only remove the channel when the component fully unmounts (shopId change),
    // NOT on token/session changes — those are handled by refs.
    return () => {
      try {
        getSupabase().removeChannel(channel);
      } catch (err) {
        console.warn("[PrintClient] Cleanup error:", err);
      }
    };
  }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentSessionId) return;

    const supabase = getSupabase();
    const orderChannel = supabase
      .channel(`order-status-${currentSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "print_orders",
          filter: `session_id=eq.${currentSessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            payment_status?: string;
            status?: string;
            token_code?: string;
          };
          if (row.token_code) {
            setToken((prev) => (prev ? { ...prev, tokenCode: row.token_code! } : prev));
          }
          if (row.payment_status === "confirmed") {
            setIsPaymentConfirmedByShop(true);
            setJobStatus("ready_for_pickup");
          }
          if (row.status === "cancelled") {
            try {
              localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
            } catch {}
            setStep("error");
            setErrorMsg("Your order was cancelled by the shop.");
          } else if (row.status === "failed" || row.status === "failed_refunded") {
            try {
              localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
            } catch {}
            setStep("error");
            setErrorMsg(
              "Hardware print spooler reported an error. The shopkeeper can retry your print at the counter."
            );
            setIsRefundPromptOpen(true);
          } else if (isOrderCompleted(row.status)) {
            try {
              localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
            } catch {}
            setJobStatus("picked_up");
          } else if (isOrderFailed(row.status)) {
            try {
              localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
            } catch {}
            setStep("error");
            setErrorMsg("Your order failed at the counter.");
          } else if (row.status) {
            setJobStatus(row.status as JobStatus);
          }
        }
      )
      .subscribe();

    // Direct real-time broadcast listener from Shop Terminal
    const directSignaling = joinSignalingChannel(shopId);
    directSignaling.on(
      "broadcast",
      { event: "order-status" },
      ({ payload }: { payload: SignalPayload }) => {
        if (payload.sessionId !== currentSessionId) return;
        if (
          payload.status === "printing" ||
          payload.status === "shredding" ||
          payload.status === "ready_for_pickup"
        ) {
          setJobStatus(payload.status as JobStatus);
        }
        if (payload.paymentStatus === "confirmed") {
          setIsPaymentConfirmedByShop(true);
          setJobStatus("ready_for_pickup");
        }
        if (payload.tokenCode) {
          setToken((prev) => (prev ? { ...prev, tokenCode: payload.tokenCode! } : prev));
        }
      }
    );
    directSignaling.on(
      "broadcast",
      { event: "payment-confirmed" },
      ({ payload }: { payload: SignalPayload }) => {
        if (payload.sessionId !== currentSessionId) return;
        setIsPaymentConfirmedByShop(true);
        setJobStatus("ready_for_pickup");
      }
    );

    return () => {
      try {
        supabase.removeChannel(orderChannel);
      } catch (err) {
        console.warn("[PrintClient] Cleanup error:", err);
      }
    };
  }, [currentSessionId, shopId]);

  // ─── Handlers ───

  const handleStartPrintAndPayment = useCallback(async () => {
    if (documents.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    const sessionId = crypto.randomUUID();
    setCurrentSessionId(sessionId);

    const hasColor = documents.some((d) => d.settings.colorMode === "color");
    const newToken = await requestTokenFromShop(shopId, {
      sessionId,
      hasColor,
      totalAmount,
      fileCount: documents.length,
    });

    // --- Token Reservation (Escrow) ---
    let localPrintTicket = "";
    try {
      const res = await fetch("/api/print/reserve-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          sessionId,
          totalAmount,
          paymentMethod: "upi",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        try {
          localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
        } catch {}
        const channel = joinSignalingChannel(shopId);
        broadcast(channel, "order-status", {
          sessionId,
          status: "cancelled",
          errorDetail: data.error || "Could not reserve print token from shop.",
        }).catch(() => {});

        setStep("error");
        setErrorMsg(data.error || "Could not reserve print token from shop.");
        setIsSubmitting(false);
        return;
      }
      localPrintTicket = data.printTicket;
      setPrintTicket(localPrintTicket);
    } catch (err) {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
      } catch {}
      const channel = joinSignalingChannel(shopId);
      broadcast(channel, "order-status", {
        sessionId,
        status: "cancelled",
        errorDetail: "Failed to contact server for token reservation.",
      }).catch(() => {});

      setStep("error");
      setErrorMsg("Failed to contact server for token reservation.");
      setIsSubmitting(false);
      return;
    }

    setToken(newToken);
    setIsPaymentConfirmedByShop(false);
    setStep("print_pay");

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

    // 1. Insert order into Supabase print_orders with retry and offline queue fallback
    let dbSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const supabase = getSupabase();
        const { error } = await supabase.from("print_orders").insert({
          shop_id: shopId,
          session_id: sessionId,
          token_code: newToken.tokenCode,
          queue_position: newToken.queuePosition,
          payment_method: "upi",
          payment_status: "pending",
          total_amount: totalAmount,
          status: "printing",
        });
        if (error) throw error;
        dbSuccess = true;
        break;
      } catch (err) {
        console.warn(`[PrintClient] print_orders insert attempt ${attempt}/3:`, err);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
    }

    if (!dbSuccess) {
      try {
        const offlineQueueKey = `printap_offline_orders_${shopId}`;
        const queue = JSON.parse(localStorage.getItem(offlineQueueKey) || "[]");
        queue.push({
          shop_id: shopId,
          session_id: sessionId,
          token_code: newToken.tokenCode,
          queue_position: newToken.queuePosition,
          payment_method: "upi",
          payment_status: "pending",
          total_amount: totalAmount,
          status: "printing",
          created_at: new Date().toISOString(),
        });
        localStorage.setItem(offlineQueueKey, JSON.stringify(queue));
      } catch (e) {
        console.warn("[PrintClient] Local offline queue error:", e);
      }
    }

    // 2. Automatically beam document to shop printer over WebRTC!
    try {
      await sendOrderToShop(
        {
          shopId,
          sessionId,
          documents,
          token: newToken,
          paymentMethod: "upi",
          paymentStatus: "pending",
          totalAmount,
          finishingServices: activeFinishing,
        },
        localPrintTicket,
        (p) => {
          setProgress(p);
          if (p.status === "complete") {
            setJobStatus("printing");
          } else if (p.status === "error") {
            try {
              localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
            } catch {}
            const channel = joinSignalingChannel(shopId);
            broadcast(channel, "order-status", {
              sessionId,
              status: "error",
              errorDetail: p.error || "Transfer failed",
            }).catch(() => {});

            try {
              getSupabase()
                .from("print_orders")
                .update({ status: "failed" })
                .eq("session_id", sessionId)
                .then(() => {});
            } catch {}

            setStep("error");
            setErrorMsg(p.error || "Document transfer interrupted. Tap below to retry.");
            setIsRefundPromptOpen(false);
            setIsSubmitting(false);
          }
        }
      );
    } catch (err) {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
      } catch {}
      const channel = joinSignalingChannel(shopId);
      broadcast(channel, "order-status", {
        sessionId,
        status: "error",
        errorDetail: String(err),
      }).catch(() => {});

      try {
        getSupabase()
          .from("print_orders")
          .update({ status: "failed" })
          .eq("session_id", sessionId)
          .then(() => {});
      } catch {}

      setStep("error");
      setErrorMsg(String(err) || "Failed to submit print. Please tap retry.");
      setIsRefundPromptOpen(false);
      setIsSubmitting(false);
    }
  }, [documents, shopId, totalAmount, activeFinishing, isSubmitting]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setDocuments([]);
    setFinishingServices([...initialFinishing]);
    setProgress(null);
    setErrorMsg("");
    setToken(null);
    setCurrentSessionId("");
    setIsPaymentConfirmedByShop(false);
    setIsRefundPromptOpen(false);
    setPrintTicket("");
    setJobStatus("queued");
    localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
  }, [shopId, initialFinishing]);

  const handleRetryPrint = useCallback(() => {
    setErrorMsg("");
    setIsRefundPromptOpen(false);
    if (documents.length > 0) {
      handleStartPrintAndPayment();
    } else {
      handleReset();
    }
  }, [documents, handleStartPrintAndPayment, handleReset]);

  const handleRefund = useCallback(async () => {
    try {
      const res = await fetch("/api/print/refund-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          sessionId: currentSessionId,
          printTicket,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsRefundPromptOpen(false);
        setErrorMsg("Token refunded successfully. You can try printing again.");
      } else {
        setErrorMsg("Refund failed: " + data.error);
      }
    } catch (err) {
      setErrorMsg("Failed to request refund.");
    }
  }, [shopId, currentSessionId, printTicket]);

  const handleEditSettings = useCallback(async () => {
    if (currentSessionId && printTicket) {
      try {
        await fetch("/api/print/refund-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId, sessionId: currentSessionId, printTicket }),
        });
      } catch (err) {
        console.warn("Failed to refund token on edit settings:", err);
      }
    }

    setStep("settings");
    setProgress(null);
    setErrorMsg("");
    setToken(null);
    setCurrentSessionId("");
    setIsPaymentConfirmedByShop(false);
    setIsRefundPromptOpen(false);
    setPrintTicket("");
    setJobStatus("queued");
    localStorage.removeItem(SESSION_STORAGE_KEY(shopId));
  }, [shopId, currentSessionId, printTicket]);

  // If the shop goes offline and there is no active transfer/order in flight, show offline screen
  const isOrderActive = step === "print_pay";
  if (!isShopOnline && !isOrderActive) {
    return (
      <ShopOffline
        shopId={shopId}
        shopName={shopName}
        onGoOnline={() => setIsShopOnline(true)}
      />
    );
  }

  const hasBottomBar =
    (step === "upload" && documents.length > 0) ||
    step === "settings" ||
    step === "preview";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900 flex flex-col relative selection:bg-zinc-900 selection:text-white overflow-x-hidden">
      {/* ─── Sticky Modern Top Bar ─── */}
      <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-zinc-200/80 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Shop Location & Live Online Status (No Logo) */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 truncate">
              {shopName}
            </span>
          </div>

          {/* Right Status / Step Pill */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-100 border border-zinc-200 text-zinc-700">
              Step {currentMilestone + 1} of 4
            </span>

            <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
              </svg>
              <span>Zero-Cloud P2P</span>
            </div>
          </div>
        </div>

        {/* ─── Integrated Sub-header Step Tracker ─── */}
        <div className="border-t border-zinc-100 bg-zinc-50/80 px-4 sm:px-6 py-2.5">
          <nav
            aria-label="Progress"
            className="max-w-2xl mx-auto flex items-center justify-between gap-1 sm:gap-2"
          >
            {MILESTONE_STEPS.map((s, i) => {
              const isCurrent = i === currentMilestone;
              const isComplete = i < currentMilestone;
              return (
                <React.Fragment key={s.key}>
                  {i > 0 && (
                    <div
                      className={`h-0.5 flex-1 min-w-3 sm:min-w-6 transition-all duration-300 ${
                        isComplete ? "bg-emerald-500" : "bg-zinc-200"
                      }`}
                    />
                  )}
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                        isComplete
                          ? "bg-emerald-500 text-white shadow-xs"
                          : isCurrent
                          ? "bg-zinc-900 text-white ring-4 ring-zinc-900/10 shadow-xs"
                          : "bg-zinc-200 text-zinc-500"
                      }`}
                    >
                      {isComplete ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-[11px] font-semibold transition-colors duration-200 ${
                        isCurrent
                          ? "text-zinc-900 font-bold"
                          : isComplete
                          ? "text-emerald-700"
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
        </div>
      </header>

      {/* ─── Main Content Area ─── */}
      <main
        className={`w-full max-w-2xl mx-auto flex-1 flex flex-col px-4 sm:px-6 ${
          hasBottomBar ? "py-4 sm:py-5 pb-24" : "py-1 sm:py-2 pb-1"
        }`}
      >
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
            onContinue={handleStartPrintAndPayment}
          />
        )}

        {/* STEP 4 — Unified Automatic Print & Concurrent Payment */}
        {step === "print_pay" && token && (
          <PrintAndPay
            shopName={shopName}
            shopId={shopId}
            upiVpa={upiVpa}
            totalAmount={totalAmount}
            documents={documents}
            activeDocumentCount={activeDocumentCount}
            token={token}
            progress={progress}
            isPaymentConfirmed={isPaymentConfirmedByShop}
            onPrintAnother={handleReset}
            onEditSettings={handleEditSettings}
          />
        )}


        {/* ERROR STATE */}
        {step === "error" && (
          <div className="animate-fade-in-up text-center max-w-md mx-auto">
            <div className="glass rounded-2xl p-8 border border-red-200/60 shadow-xl bg-white/95">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl font-bold border border-red-100">
                ✕
              </div>
              <h2 className="text-lg font-bold text-zinc-900 mb-2">
                Print Not Completed
              </h2>
              <p className="text-xs text-zinc-600 mb-6 leading-relaxed">
                {errorMsg || "The counter could not complete your print. Tap below to retry."}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRetryPrint}
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl btn-primary text-sm font-bold text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                  <span>{isSubmitting ? "Retrying..." : "Retry Print"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-zinc-500 hover:text-zinc-800 font-medium py-1 transition-colors cursor-pointer"
                >
                  Change documents or start over
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Persistent Docked Bottom Bar (Edge-to-Edge, Flush, NOT floating!) ─── */}
      {step === "upload" && documents.length > 0 && (
        <BottomPriceBar
          totalPrice={totalAmount}
          printingCost={printingCost}
          platformFee={resolvedPlatformFee}
          gstPercentage={resolvedGstPercentage}
          gstAmount={resolvedGstAmount}
          totalCharge={resolvedTotalCharge}
          documentCount={documents.length}
          totalSheets={totalSheets}
          colorMode={globalColorMode}
          activeFinishingCount={activeFinishing.length}
          activeFinishingLabels={activeFinishing.map((s) => s.label)}
          buttonLabel="Continue →"
          onContinue={() => setStep("settings")}
        />
      )}

      {step === "settings" && (
        <BottomPriceBar
          totalPrice={totalAmount}
          printingCost={printingCost}
          platformFee={resolvedPlatformFee}
          gstPercentage={resolvedGstPercentage}
          gstAmount={resolvedGstAmount}
          totalCharge={resolvedTotalCharge}
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
          printingCost={printingCost}
          platformFee={resolvedPlatformFee}
          gstPercentage={resolvedGstPercentage}
          gstAmount={resolvedGstAmount}
          totalCharge={resolvedTotalCharge}
          documentCount={documents.length}
          totalSheets={totalSheets}
          colorMode={globalColorMode}
          activeFinishingCount={activeFinishing.length}
          activeFinishingLabels={activeFinishing.map((s) => s.label)}
          buttonLabel={isSubmitting ? "Processing..." : "Confirm →"}
          onContinue={handleStartPrintAndPayment}
          disabled={isSubmitting}
          onBack={() => setStep("settings")}
        />
      )}

      {/* ─── Footer ─── */}
      <footer
        className={`py-2 text-center text-zinc-400 text-[11px] font-medium space-y-1 select-none ${
          hasBottomBar ? "mb-20 sm:mb-24" : "mb-1 mt-auto"
        }`}
      >
        <div className="flex items-center justify-center gap-3 text-zinc-500">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 transition-colors underline-offset-2 hover:underline"
          >
            Terms
          </a>
          <span>•</span>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 transition-colors underline-offset-2 hover:underline"
          >
            Privacy
          </a>
          <span>•</span>
          <a
            href="/refund-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 transition-colors underline-offset-2 hover:underline"
          >
            Refunds
          </a>
          <span>•</span>
          <a
            href="/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 transition-colors underline-offset-2 hover:underline"
          >
            Contact
          </a>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">
          powered by PRINTAP
        </div>
      </footer>
    </div>
  );
}
