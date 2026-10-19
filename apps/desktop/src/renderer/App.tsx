import React, { useState, useEffect, useCallback, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar, type AdminPage } from "./components/Sidebar";
import { Login } from "./components/Login";
import { LiveDashboard, type LiveJob } from "./components/LiveDashboard";
import { Profile } from "./components/Profile";
import { PrintersControl, type PrinterAssignment } from "./components/PrintersControl";
import { ServicesRates, type DirtyHandler } from "./components/ServicesRates";
import { Analytics } from "./components/Analytics";
import { CounterQr } from "./components/CounterQr";
import { Tokens } from "./components/Tokens";
import { PrintHistory } from "./components/PrintHistory";
import { IconSidebarToggle } from "./components/Icons";
import {
  startShopSignaling,
  stopShopSignaling,
  broadcastPaymentConfirmed,
  broadcastOrderStatus,
  broadcastTokenAssigned,
} from "./lib/shop-signaling";
import {
  FifoPrintDispatcher,
  type QueuedPrintJob,
  type TokenAllocation,
} from "./lib/fifo-dispatcher";
import { getSupabase, setShopOnline, broadcast } from "@printap/shared";
import { startPresence, stopPresence } from "./lib/shop-presence";
import { UpdateScreen } from "./components/UpdateScreen";
import { UnsavedChangesModal } from "./components/UnsavedChangesModal";
import type { RealtimeChannel } from "@supabase/supabase-js";

function addBoundedSet(set: Set<string>, key: string, maxSize = 250): void {
  set.add(key);
  if (set.size > maxSize) {
    const first = set.values().next().value;
    if (first !== undefined) set.delete(first);
  }
}

function ShopAdminShell(): React.ReactElement {
  const { isAuthenticated, isLoading, shopId, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<AdminPage>("live");

  // Sidebar visibility state (persisted)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("printap_sidebar_visible");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem("printap_sidebar_visible", String(isSidebarOpen));
    } catch {}
  }, [isSidebarOpen]);

  // Keyboard shortcut Alt+S or Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && (e.key === "s" || e.key === "S")) ||
        ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B"))
      ) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Live session state
  const [isListening, setIsListening] = useState(false);
  const [activeJob, setActiveJob] = useState<LiveJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<LiveJob[]>([]);
  const [pendingQueue, setPendingQueue] = useState<QueuedPrintJob[]>([]);
  const [todayPrintsCount, setTodayPrintsCount] = useState<number>(0);

  // Shop Online/Offline Presence state (always starts offline on launch until toggled)
  const [isShopOnline, setIsShopOnline] = useState<boolean>(false);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);
  
  // Token Subscription state
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const tokenBalanceRef = useRef<number | null>(null);
  const [tokenAlert, setTokenAlert] = useState<{ balance: number; threshold: boolean } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const [printers, setPrinters] = useState<PrinterInfo[]>(() => {
    try {
      const cached = localStorage.getItem("printap_cached_printers");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  // Dirty handlers registry for pages with editable unsaved changes (Services, Printers, etc.)
  const dirtyHandlersRef = useRef<Record<string, DirtyHandler | null>>({});
  const [unsavedModal, setUnsavedModal] = useState<{
    isOpen: boolean;
    targetPage?: AdminPage;
    isLogout?: boolean;
    pageName: string;
  } | null>(null);
  const [isSavingUnsaved, setIsSavingUnsaved] = useState(false);

  // Intercept page navigation to prevent loss of unsaved changes
  const handleSelectPage = useCallback(
    (targetPage: AdminPage) => {
      if (targetPage === currentPage) return;

      const currentHandler = dirtyHandlersRef.current[currentPage];
      if (currentHandler && currentHandler.isDirty()) {
        setUnsavedModal({
          isOpen: true,
          targetPage,
          pageName: currentHandler.pageName || "current page",
        });
        return;
      }

      setCurrentPage(targetPage);
    },
    [currentPage]
  );

  // Intercept logout/disconnect terminal when changes are dirty
  const handleLogoutRequest = useCallback(() => {
    const currentHandler = dirtyHandlersRef.current[currentPage];
    if (currentHandler && currentHandler.isDirty()) {
      setUnsavedModal({
        isOpen: true,
        isLogout: true,
        pageName: currentHandler.pageName || "current page",
      });
      return;
    }

    logout();
  }, [currentPage, logout]);

  // Modal actions: Save & Continue
  const handleSaveAndContinue = async () => {
    const currentHandler = dirtyHandlersRef.current[currentPage];
    if (currentHandler) {
      setIsSavingUnsaved(true);
      const success = await currentHandler.save();
      setIsSavingUnsaved(false);
      if (!success) {
        return;
      }
    }

    const modal = unsavedModal;
    setUnsavedModal(null);
    if (modal?.isLogout) {
      logout();
    } else if (modal?.targetPage) {
      setCurrentPage(modal.targetPage);
    }
  };

  // Modal actions: Discard & Continue
  const handleDiscardAndContinue = () => {
    const currentHandler = dirtyHandlersRef.current[currentPage];
    if (currentHandler) {
      currentHandler.discard();
    }

    const modal = unsavedModal;
    setUnsavedModal(null);
    if (modal?.isLogout) {
      logout();
    } else if (modal?.targetPage) {
      setCurrentPage(modal.targetPage);
    }
  };

  // Modal actions: Cancel Navigation
  const handleCancelNavigation = () => {
    setUnsavedModal(null);
  };

  // Ref to hold current assignments for printer routing
  const assignmentsRef = useRef<Record<string, PrinterAssignment>>({});
  // Track handled order sessions to avoid duplicate processing with legacy onFileReceived
  const handledOrderSessions = useRef<Set<string>>(new Set());
  // Ref to hold active signaling channel for broadcasting payment confirmation
  const signalingChannelRef = useRef<RealtimeChannel | null>(null);
  // Track sessions where payment has been confirmed so spool completion does not overwrite it
  const confirmedPaymentSessionsRef = useRef<Set<string>>(new Set());
  // FIFO Print Dispatcher with Local Atomic Token Allocator
  const fifoDispatcherRef = useRef<FifoPrintDispatcher | null>(null);

  // Stable references for high-frequency callbacks
  const activeJobRef = useRef<LiveJob | null>(null);
  activeJobRef.current = activeJob;
  const recentJobsRef = useRef<LiveJob[]>([]);
  recentJobsRef.current = recentJobs;

  // Manual or initial printer detection (physical hardware only)
  const rescanPrinters = useCallback(async () => {
    setIsLoadingPrinters(true);
    try {
      const result = await window.electronAPI.listPrinters();
      if (result.success && result.printers) {
        const physicalOnly = result.printers.filter((p) => p.isPhysical);
        setPrinters(physicalOnly);
        try {
          localStorage.setItem("printap_cached_printers", JSON.stringify(physicalOnly));
        } catch {}
      }
    } catch (err) {
      console.error("[App] Printer discovery error:", err);
    } finally {
      setIsLoadingPrinters(false);
    }
  }, []);

  // 1. Discover printers ONLY once on fresh app launch
  useEffect(() => {
    rescanPrinters();
  }, [rescanPrinters]);

  // 2. Fetch today's print count and recent orders from Supabase when shopId is loaded
  const loadTodayPrintsCount = useCallback(async (id: string) => {
    try {
      const supabase = getSupabase();
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

      const { count, error } = await supabase
        .from("print_orders")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", id)
        .gte("created_at", startOfToday.toISOString());

      if (!error && typeof count === "number") {
        setTodayPrintsCount(count);
        if (fifoDispatcherRef.current && count > 0) {
          fifoDispatcherRef.current.syncSequence(count);
        }
      }

      // Fetch shop details including token_balance
      const { data: shopData } = await supabase
        .from("shops")
        .select("token_balance")
        .eq("id", id)
        .maybeSingle();
      
      if (shopData) {
        setTokenBalance(shopData.token_balance);
        tokenBalanceRef.current = shopData.token_balance;
        if (shopData.token_balance <= 10) {
          setTokenAlert({ balance: shopData.token_balance, threshold: true });
        }
      }

      // Also hydrate today's print_orders into recentJobs so pending payments & history remain visible
      const { data: orders } = await supabase
        .from("print_orders")
        .select("session_id, token_code, payment_method, payment_status, total_amount, status, created_at")
        .eq("shop_id", id)
        .gte("created_at", startOfToday.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (orders && orders.length > 0) {
        if (!fifoDispatcherRef.current) {
          fifoDispatcherRef.current = new FifoPrintDispatcher(id, count || orders.length);
        }
        fifoDispatcherRef.current.syncFromOrders(orders);

        setRecentJobs((prev) => {
          const map = new Map<string, LiveJob>();
          orders.forEach((o) => {
            const isFailed = o.status === "failed" || o.status === "failed_refunded";
            const isCancelled = o.status === "cancelled";
            const isPrinting = o.status === "printing";
            const isQueued = o.status === "queued";
            const isReady = o.status === "ready_for_pickup";
            const isPickedUp = o.status === "picked_up";
            const isDone = isReady || isPickedUp;
            const isConfirmed = !isFailed && !isCancelled && isDone && (o.payment_status === "confirmed" || isPickedUp);

            if (isConfirmed) {
              addBoundedSet(confirmedPaymentSessionsRef.current, o.session_id);
            }
            map.set(o.session_id, {
              sessionId: o.session_id,
              tokenCode: o.token_code || undefined,
              totalAmount: Number(o.total_amount) || 0,
              paymentMethod: (o.payment_method as any) || "upi",
              paymentStatus: isConfirmed ? "confirmed" : isFailed || isCancelled ? "pending" : (o.payment_status as any) || "pending",
              status: isFailed ? "error" : isCancelled ? "cancelled" : isPrinting ? "printing" : isQueued ? "queued" : isDone ? "done" : "error",
              detail: isFailed ? "Print failed on spooler" : isCancelled ? "Cancelled" : `Token ${o.token_code || ""}`,
              timestamp: new Date(o.created_at),
            });
          });
          prev.forEach((p) => {
            const existing = map.get(p.sessionId);
            if (existing && (existing.status === "error" || existing.status === "cancelled")) {
              map.set(p.sessionId, {
                ...p,
                ...existing,
                tokenCode: p.tokenCode || existing?.tokenCode,
                totalAmount:
                  p.totalAmount !== undefined && p.totalAmount > 0
                    ? p.totalAmount
                    : existing?.totalAmount,
              });
            } else {
              map.set(p.sessionId, {
                ...existing,
                ...p,
                tokenCode: p.tokenCode || existing?.tokenCode,
                totalAmount:
                  p.totalAmount !== undefined && p.totalAmount > 0
                    ? p.totalAmount
                    : existing?.totalAmount,
              });
            }
          });
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.warn("[App] Could not load today's count:", e);
    }
  }, []);

  // Midnight day rollover watcher: automatically resets token counter every day
  useEffect(() => {
    let lastDate = new Date().toDateString();
    const interval = setInterval(() => {
      const currentDate = new Date().toDateString();
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        console.log("[App] Calendar day rolled over, resetting today's token counter");
        setTodayPrintsCount(0);
        if (shopId) {
          loadTodayPrintsCount(shopId);
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [shopId, loadTodayPrintsCount]);

  // 3. Load printer assignments into ref for automatic routing
  const refreshAssignments = useCallback((id: string) => {
    try {
      const cached = localStorage.getItem(`printap_printers_${id}`);
      if (cached) {
        assignmentsRef.current = JSON.parse(cached);
        return;
      }
    } catch {
      // ignore
    }

    // Auto-discover and register default Windows printer if assignments are empty
    if (Object.keys(assignmentsRef.current).length === 0 && window.electronAPI?.listPrinters) {
      window.electronAPI.listPrinters().then((res) => {
        if (res?.success && res.printers && res.printers.length > 0) {
          const physicalPrinters = res.printers.filter((p) => p.isPhysical);
          if (physicalPrinters.length === 0) return;
          const defaultP = physicalPrinters.find((p) => p.isDefault) || physicalPrinters[0];
          const autoMap: Record<string, PrinterAssignment> = {
            [defaultP.name]: {
              shop_id: id,
              printer_name: defaultP.name,
              printer_number: 1,
              role: "both",
              is_default: true,
              is_active: true,
            },
          };
          assignmentsRef.current = autoMap;
          try {
            localStorage.setItem(`printap_printers_${id}`, JSON.stringify(autoMap));
          } catch {}
          console.log(`[App] Auto-assigned default physical printer "${defaultP.name}" as Printer #1`);
        }
      }).catch((err) => console.warn("[App] Failed to auto-assign default printer:", err));
    }
  }, []);

  // Wire FIFO Print Dispatcher callbacks
  useEffect(() => {
    if (!fifoDispatcherRef.current) {
      fifoDispatcherRef.current = new FifoPrintDispatcher(
        shopId || "default",
        todayPrintsCount
      );
    } else if (shopId) {
      fifoDispatcherRef.current.setShopId(shopId, todayPrintsCount);
    }

    fifoDispatcherRef.current.setCallbacks({
      onJobStarted: (job, printerName) => {
        console.log(
          `[App] Dispatcher: Job ${job.tokenCode} started printing on ${printerName}`
        );
        const isAlreadyConfirmed = confirmedPaymentSessionsRef.current.has(
          job.sessionId
        );

        setActiveJob((prev) => ({
          sessionId: job.sessionId,
          tokenCode: job.tokenCode,
          fileCount: job.files.length,
          files: job.files.map((f) => ({
            fileName: f.fileName,
            fileSize: f.fileSize,
            pageCount: f.pageCount,
            settings: f.settings,
          })),
          totalAmount: job.totalAmount,
          paymentMethod: job.paymentMethod || prev?.paymentMethod || "upi",
          paymentStatus:
            isAlreadyConfirmed || (prev?.sessionId === job.sessionId && prev?.paymentStatus === "confirmed")
              ? "confirmed"
              : (job.paymentStatus as any) || "pending",
          fileName:
            job.files.length > 1
              ? `${job.files.length} documents (${job.tokenCode})`
              : job.files[0]?.fileName,
          status: "printing",
          detail: `Token ${job.tokenCode} (${job.files.length} file(s)) spooling to ${printerName}...`,
          timestamp: new Date(),
        }));
      },

      onJobFileProgress: (
        sessionId,
        fileName,
        fileIndex,
        totalFiles,
        printerName
      ) => {
        setActiveJob((prev) => {
          if (!prev || prev.sessionId !== sessionId) return prev;
          return {
            ...prev,
            status: "printing",
            detail: `Printing ${fileIndex}/${totalFiles}: ${fileName} on ${printerName}`,
          };
        });
      },

      onJobCompleted: async (job, printerName) => {
        console.log(
          `[App] Dispatcher: Job ${job.tokenCode} completed on ${printerName}`
        );
        const isConfirmed = confirmedPaymentSessionsRef.current.has(job.sessionId);
        const paymentConfirmed = isConfirmed || job.paymentStatus === "confirmed";

        if (paymentConfirmed) {
          addBoundedSet(confirmedPaymentSessionsRef.current, job.sessionId);
        }

        // Record print event in Supabase ledger
        try {
          const supabase = getSupabase();
          await supabase.from("print_events").insert({
            shop_id: shopId,
            session_id: job.sessionId,
            fee_amount: 1.0,
          });
        } catch (err) {
          console.warn("[App] Could not insert print_event:", err);
        }

        // Tokens are now deducted securely by the customer web app (Token Escrow System).
        // No local deduction happens here to prevent modding.

        const completedJob: LiveJob = {
          sessionId: job.sessionId,
          tokenCode: job.tokenCode,
          fileCount: job.files.length,
          files: job.files.map((f) => ({
            fileName: f.fileName,
            fileSize: f.fileSize,
            pageCount: f.pageCount,
            settings: f.settings,
          })),
          totalAmount: job.totalAmount,
          paymentMethod: job.paymentMethod || "upi",
          paymentStatus: paymentConfirmed ? "confirmed" : (job.paymentStatus as any) || "pending",
          paymentConfirmedAt: paymentConfirmed ? new Date() : undefined,
          fileName:
            job.files.length > 1
              ? `${job.files.length} documents`
              : job.files[0]?.fileName,
          status: "done",
          detail: `Token ${job.tokenCode} — ${job.files.length} file(s) printed & shredded`,
          timestamp: new Date(),
        };

        setRecentJobs((prev) => {
          const filtered = prev.filter((j) => j.sessionId !== job.sessionId);
          return [completedJob, ...filtered.slice(0, 19)];
        });
        setTodayPrintsCount((c) => c + job.files.length);

        setActiveJob((prev) => {
          if (!prev || prev.sessionId !== job.sessionId) return prev;
          return {
            ...prev,
            tokenCode: job.tokenCode,
            totalAmount: job.totalAmount,
            paymentStatus: paymentConfirmed ? "confirmed" : prev.paymentStatus,
            status: "done",
            detail: `Order ${job.tokenCode} complete! Paper ready on tray.`,
          };
        });

        setTimeout(() => {
          setActiveJob((prev) => (prev?.sessionId === job.sessionId ? null : prev));
        }, 5000);
      },

      onJobFailed: async (job, error, printerName) => {
        console.error(
          `[App] Dispatcher: Job ${job.tokenCode} failed on ${printerName}:`,
          error
        );

        // Update database print_orders status to failed
        try {
          const supabase = getSupabase();
          await supabase
            .from("print_orders")
            .update({ status: "failed" })
            .eq("session_id", job.sessionId);
        } catch (dbErr) {
          console.warn("[App] Could not update print_order status to failed:", dbErr);
        }

        // NOTE: We do not broadcast error to customer immediately here.
        // We allow the shopkeeper to inspect the printer, fix paper/offline, and hit "Retry".
        // The customer error modal will only be triggered if the shopkeeper explicitly closes/dismisses or cancels.

        const failedJob: LiveJob = {
          sessionId: job.sessionId,
          tokenCode: job.tokenCode,
          fileCount: job.files.length,
          files: job.files.map((f) => ({
            fileName: f.fileName,
            fileSize: f.fileSize,
            pageCount: f.pageCount,
            settings: f.settings,
          })),
          fileName: job.files[0]?.fileName || `Print #${job.sessionId.slice(0, 8)}`,
          status: "error",
          detail: `${error} (${printerName})`,
          timestamp: new Date(),
          totalAmount: job.totalAmount,
          paymentMethod: job.paymentMethod,
          paymentStatus: "pending",
        };
        setRecentJobs((prev) => {
          const filtered = prev.filter((j) => j.sessionId !== job.sessionId);
          return [failedJob, ...filtered.slice(0, 19)];
        });
        setActiveJob(failedJob);
      },
    });
  }, [shopId]);

  // 4. Listen to hardware status events from Electron Main
  useEffect(() => {
    const cleanup = window.electronAPI.onPrintStatus((data) => {
      setActiveJob((prev) => {
        if (!prev || prev.sessionId !== data.sessionId) return prev;
        let newStatus = prev.status;
        if (data.stage === "saving" || data.stage === "saved") newStatus = "saving";
        else if (data.stage === "printing" || data.stage === "printed")
          newStatus = "printing";
        else if (data.stage === "shredding" || data.stage === "shredded")
          newStatus = "shredding";
        else if (data.stage === "complete") newStatus = "done";
        else if (data.stage === "error") newStatus = "error";

        return {
          ...prev,
          status: newStatus,
          stage: data.stage,
          detail: data.detail,
        };
      });
    });

    return cleanup;
  }, []);

  const handleToggleOnline = useCallback(
    async (online: boolean) => {
      if (!shopId) return;

      setIsTogglingOnline(true);
      try {
        if (online) {
          try {
            const result = await window.electronAPI.listPrinters();
            const physicalPrinters = (result?.printers || []).filter((p: any) => p.isPhysical);
            if (physicalPrinters.length === 0) {
              setToastMessage("Cannot go online: No physical printer connected. Please connect a printer and try again.");
              return;
            }
          } catch (err) {
            console.error("Failed to check printers:", err);
            setToastMessage("Failed to check connected printers.");
            return;
          }

          const res = await startPresence(shopId);
          if (res.success) {
            setIsShopOnline(true);
            try {
              localStorage.setItem("printap_shop_online_pref", "true");
            } catch {}
          }
        } else {
          await stopPresence();
          setIsShopOnline(false);
          try {
            localStorage.setItem("printap_shop_online_pref", "false");
          } catch {}
        }
      } catch (err) {
        console.error("[App] Toggle online error:", err);
      } finally {
        setIsTogglingOnline(false);
      }
    },
    [shopId]
  );

  // Synchronize presence on authentication or shop change
  useEffect(() => {
    if (!isAuthenticated || !shopId) {
      stopPresence();
      return;
    }

    let isMounted = true;
    const initPresence = async () => {
      // Default to ONLINE automatically upon login/launch so customers can connect immediately.
      // If the shop owner previously explicitly chose to go offline, honor that preference.
      const pref = localStorage.getItem("printap_shop_online_pref");
      const shouldBeOnline = pref !== "false";

      if (shouldBeOnline) {
        try {
          const result = await window.electronAPI.listPrinters();
          const physicalPrinters = (result?.printers || []).filter((p: any) => p.isPhysical);
          if (physicalPrinters.length === 0) {
            console.warn("[App] No physical printers found, staying offline.");
            await setShopOnline(shopId, false);
            if (isMounted) setIsShopOnline(false);
            return;
          }
        } catch (err) {
          console.error("[App] Failed to check printers during initPresence:", err);
        }

        console.log(`[App] Automatically setting terminal online for shop ${shopId}...`);
        const res = await startPresence(shopId);
        if (isMounted && res.success) {
          setIsShopOnline(true);
        }
      } else {
        await setShopOnline(shopId, false);
        if (isMounted) {
          setIsShopOnline(false);
        }
      }
    };

    initPresence();

    // Subscribe to token_balance changes (admin top-ups or deductions)
    const supabase = getSupabase();
    const channel = supabase
      .channel(`shop-tokens-${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "shops",
          filter: `id=eq.${shopId}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.token_balance !== undefined) {
            const newBalance = payload.new.token_balance;
            setTokenBalance(newBalance);
            if (newBalance > 10) {
              setTokenAlert(null);
            } else {
              setTokenAlert({ balance: newBalance, threshold: true });
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, shopId]);

  // Auto-offline when tokens reach 0
  useEffect(() => {
    if (tokenBalance === 0 && isShopOnline) {
      console.warn("[App] Token balance is 0. Automatically going offline.");
      handleToggleOnline(false);
    }
  }, [tokenBalance, isShopOnline, handleToggleOnline]);

  // Graceful shutdown listener from Electron Main
  useEffect(() => {
    if (!window.electronAPI?.onAppWillQuit) return;
    const cleanup = window.electronAPI.onAppWillQuit(async () => {
      console.log("[App] onAppWillQuit received, stopping presence...");
      await stopPresence();
      if (window.electronAPI.confirmQuit) {
        window.electronAPI.confirmQuit();
      }
    });
    return cleanup;
  }, []);

  // 5. Connect WebRTC Signaling when authenticated AND shop is online
  useEffect(() => {
    if (!isAuthenticated || !shopId || !isShopOnline) {
      setIsListening(false);
      return;
    }

    loadTodayPrintsCount(shopId);
    refreshAssignments(shopId);

    console.log(`[App] Initializing signaling for shop ${shopId}...`);
    setIsListening(true);

    const channel = startShopSignaling(shopId, {
      onSessionStart: (sessionId) => {
        setActiveJob((prev) => ({
          ...prev,
          sessionId,
          status: "receiving",
          progressPct: 0,
          timestamp: prev?.timestamp || new Date(),
        }));
      },

      onRequestToken: async (sessionId, hasColor, totalAmount, fileCount) => {
        refreshAssignments(shopId);
        if (!fifoDispatcherRef.current) {
          fifoDispatcherRef.current = new FifoPrintDispatcher(shopId, todayPrintsCount);
        }

        const allocation = fifoDispatcherRef.current.allocateToken(
          sessionId,
          hasColor,
          assignmentsRef.current
        );

        console.log(
          `[App] Atomically allocated local token ${allocation.tokenCode} (seq #${allocation.tokenCode}) for session ${sessionId.slice(0, 8)}`
        );

        // Broadcast assign-token and order-status back to customer immediately
        if (signalingChannelRef.current) {
          try {
            await broadcastTokenAssigned(signalingChannelRef.current, {
              sessionId,
              tokenCode: allocation.tokenCode,
              printerNumber: allocation.printerNumber,
              queuePosition: allocation.queuePosition,
            });
            await broadcastOrderStatus(signalingChannelRef.current, {
              sessionId,
              tokenCode: allocation.tokenCode,
              printerNumber: allocation.printerNumber,
              queuePosition: allocation.queuePosition,
              paymentStatus: confirmedPaymentSessionsRef.current.has(sessionId)
                ? "confirmed"
                : "pending",
            });
          } catch (err) {
            console.warn("[App] Error broadcasting assign-token:", err);
          }
        }

        const isConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);
        setActiveJob((prev) => ({
          ...prev,
          sessionId,
          tokenCode: allocation.tokenCode,
          totalAmount: totalAmount || prev?.totalAmount || 0,
          paymentMethod: prev?.paymentMethod || "upi",
          paymentStatus: isConfirmed ? "confirmed" : "pending",
          fileCount: fileCount || prev?.fileCount || 1,
          status: "receiving",
          detail: `Assigned Token ${allocation.tokenCode} — ready for document stream`,
          timestamp: new Date(),
        }));
      },

      onManifestReceived: async (sessionId, manifestOrder) => {
        addBoundedSet(handledOrderSessions.current, sessionId);
        refreshAssignments(shopId);
        if (!fifoDispatcherRef.current) {
          fifoDispatcherRef.current = new FifoPrintDispatcher(shopId, todayPrintsCount);
        }

        const hasColor =
          manifestOrder.finishingServices?.some((f: any) => f.colorMode === "color") || false;

        // Use already allocated token or atomically allocate one locally
        const allocation =
          fifoDispatcherRef.current.getAllocatedToken(sessionId) ||
          fifoDispatcherRef.current.allocateToken(sessionId, hasColor, assignmentsRef.current);

        const token = allocation.tokenCode;
        const amount = manifestOrder.totalAmount;
        const isAlreadyConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

        // Broadcast authoritative token status back to customer
        if (signalingChannelRef.current) {
          try {
            await broadcastOrderStatus(signalingChannelRef.current, {
              sessionId,
              tokenCode: token,
              printerNumber: allocation.printerNumber,
              queuePosition: allocation.queuePosition,
              paymentStatus: isAlreadyConfirmed
                ? "confirmed"
                : manifestOrder.paymentStatus || "pending",
            });
          } catch (err) {
            console.warn("[App] Error broadcasting initial order status:", err);
          }
        }

        setActiveJob((prev) => ({
          ...prev,
          sessionId,
          tokenCode: token,
          totalAmount: amount !== undefined && amount > 0 ? amount : prev?.totalAmount,
          paymentMethod: manifestOrder.paymentMethod || prev?.paymentMethod || "upi",
          paymentStatus:
            isAlreadyConfirmed || (prev?.sessionId === sessionId && prev?.paymentStatus === "confirmed")
              ? "confirmed"
              : (manifestOrder.paymentStatus as any) || prev?.paymentStatus || "pending",
          fileCount: manifestOrder.totalFiles,
          status: "receiving",
          detail: `Receiving order ${token} (${manifestOrder.totalFiles} files)...`,
          timestamp: prev?.timestamp || new Date(),
        }));

        setRecentJobs((prev) => {
          const existing = prev.find((j) => j.sessionId === sessionId);
          const paymentConfirmed =
            isAlreadyConfirmed ||
            existing?.paymentStatus === "confirmed" ||
            manifestOrder.paymentStatus === "confirmed";

          if (paymentConfirmed) {
            addBoundedSet(confirmedPaymentSessionsRef.current, sessionId);
          }

          const filtered = prev.filter((j) => j.sessionId !== sessionId);
          const initialJob: LiveJob = {
            sessionId,
            tokenCode: token,
            totalAmount: amount !== undefined && amount > 0 ? amount : existing?.totalAmount,
            paymentMethod: manifestOrder.paymentMethod || existing?.paymentMethod || "upi",
            paymentStatus: paymentConfirmed ? "confirmed" : existing?.paymentStatus || "pending",
            paymentConfirmedAt: existing?.paymentConfirmedAt,
            fileCount: manifestOrder.totalFiles,
            fileName: `Order ${token}`,
            status: "receiving",
            detail: `Receiving ${manifestOrder.totalFiles} file(s)...`,
            timestamp: existing?.timestamp || new Date(),
          };
          return [initialJob, ...filtered.slice(0, 19)];
        });
      },

      onFileProgress: (sessionId, fileName, pct, _received, _total, fileIndex, totalFiles) => {
        setActiveJob((prev) => ({
          ...prev,
          sessionId,
          fileName:
            totalFiles && totalFiles > 1
              ? `File ${fileIndex || 1}/${totalFiles}: ${fileName}`
              : fileName,
          status: "receiving",
          progressPct: pct,
          fileCount: totalFiles,
          timestamp: prev?.timestamp || new Date(),
        }));
      },

      onOrderReceived: async (receivedOrder) => {
        const { sessionId, order, files } = receivedOrder;
        addBoundedSet(handledOrderSessions.current, sessionId);

        refreshAssignments(shopId);
        if (!fifoDispatcherRef.current) {
          fifoDispatcherRef.current = new FifoPrintDispatcher(shopId, todayPrintsCount);
        }

        const hasColor = files.some((f) => f.settings?.colorMode === "color");
        const allocation =
          fifoDispatcherRef.current.getAllocatedToken(sessionId) ||
          fifoDispatcherRef.current.allocateToken(sessionId, hasColor, assignmentsRef.current);

        const finalTokenCode = allocation.tokenCode;
        const finalAmount =
          order.totalAmount !== undefined && order.totalAmount > 0
            ? order.totalAmount
            : activeJob?.totalAmount !== undefined && activeJob.totalAmount > 0
            ? activeJob.totalAmount
            : 0;

        const isAlreadyConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

        console.log(
          `[App] Order received: Token ${finalTokenCode} (₹${finalAmount}) for printer #${allocation.printerNumber}, ${files.length} files. Enqueueing into FIFO queue.`
        );

        // Pre-print token gate
        // We do a lightweight optimistic check here before enqueuing.
        // If balance is <= 0, we reject the job to save paper/ink.
        const currentBalance = tokenBalanceRef.current !== null ? tokenBalanceRef.current : 1;
        if (currentBalance <= 0) {
          console.warn(`[App] Rejected order ${sessionId}: Shop is out of tokens.`);
          
          if (signalingChannelRef.current) {
            broadcastOrderStatus(signalingChannelRef.current, {
              sessionId,
              tokenCode: "ERR",
              status: "error",
              errorDetail: "Shop is out of printing tokens. Please try again later.",
            }).catch((err) => console.warn("[App] Error broadcasting error detail:", err));
          }
          
          setRecentJobs((prev) => {
            const filtered = prev.filter((j) => j.sessionId !== sessionId);
            const failedJob: LiveJob = {
              sessionId,
              tokenCode: "ERR",
              fileName: `Order (No Tokens)`,
              status: "error",
              detail: "Rejected: Shop is out of printing tokens",
              timestamp: new Date(),
              totalAmount: finalAmount,
              paymentMethod: order.paymentMethod || "upi",
              paymentStatus: "pending",
              fileCount: files.length,
            };
            return [failedJob, ...filtered.slice(0, 19)];
          });
          setActiveJob((prev) => (prev?.sessionId === sessionId ? null : prev));
          
          return;
        }

        // Update Supabase print_orders token_code asynchronously
        try {
          const supabase = getSupabase();
          await supabase
            .from("print_orders")
            .update({ token_code: finalTokenCode })
            .eq("session_id", sessionId);
        } catch {}

        // Instead of enqueuing directly, add it to pendingQueue for shop owner to confirm.
        const newJob: QueuedPrintJob = {
          sessionId,
          tokenCode: finalTokenCode,
          printerNumber: allocation.printerNumber,
          targetPrinterName: allocation.targetPrinterName,
          hasColor,
          files: files.map((f) => ({
            fileId: f.fileId,
            fileName: f.fileName,
            fileSize: f.fileSize,
            pageCount: f.pageCount,
            settings: f.settings,
            buffer: f.buffer,
          })),
          totalAmount: finalAmount,
          paymentMethod: order.paymentMethod || "upi",
          paymentStatus: isAlreadyConfirmed ? "confirmed" : (order.paymentStatus as any) || "pending",
          enqueuedAt: new Date(),
        };

        setPendingQueue(prev => {
          const filtered = prev.filter(j => j.sessionId !== sessionId);
          return [...filtered, newJob];
        });

        // Clear active streaming job now that files have arrived into the queue
        setActiveJob((prev) => (prev?.sessionId === sessionId ? null : prev));

        setRecentJobs((prev) =>
          prev.map((j) =>
            j.sessionId === sessionId
              ? {
                  ...j,
                  status: "queued",
                  detail: `Files received (${files.length}) — awaiting print`,
                  progressPct: 100,
                  fileCount: files.length,
                  files: files.map((f) => ({
                    fileName: f.fileName,
                    fileSize: f.fileSize,
                    pageCount: f.pageCount,
                    settings: f.settings,
                  })),
                }
              : j
          )
        );

        // Tell the customer we received the files and are waiting for confirmation
        if (signalingChannelRef.current) {
          try {
             broadcastOrderStatus(signalingChannelRef.current, {
               sessionId,
               tokenCode: finalTokenCode,
               status: "pending_payment", 
             });
          } catch {}
        }
      },

      onFileReceived: async (sessionId, buffer, fileName) => {
        // If this session was already handled as a multi-file order, skip
        if (handledOrderSessions.current.has(sessionId)) {
          return;
        }

        refreshAssignments(shopId);
        if (!fifoDispatcherRef.current) {
          fifoDispatcherRef.current = new FifoPrintDispatcher(shopId, todayPrintsCount);
        }

        const allocation =
          fifoDispatcherRef.current.getAllocatedToken(sessionId) ||
          fifoDispatcherRef.current.allocateToken(sessionId, false, assignmentsRef.current);

        const isLegacyConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

        console.log(
          `[App] Legacy file received: ${fileName || sessionId}. Enqueueing into FIFO queue with Token ${allocation.tokenCode}`
        );

        fifoDispatcherRef.current.enqueue(
          {
            sessionId,
            tokenCode: allocation.tokenCode,
            printerNumber: allocation.printerNumber,
            targetPrinterName: allocation.targetPrinterName,
            hasColor: false,
            files: [
              {
                fileName: fileName || "Document.pdf",
                fileSize: buffer.byteLength,
                pageCount: 1,
                settings: {
                  copies: 1,
                  colorMode: "bw",
                  duplex: "single",
                  pagesPerSheet: 1,
                  pageFit: "fit",
                  orientation: "portrait",
                },
                buffer,
              },
            ],
            totalAmount: 5,
            paymentMethod: "cash",
            paymentStatus: isLegacyConfirmed ? "confirmed" : "pending",
            enqueuedAt: new Date(),
          },
          assignmentsRef.current
        );
      },

      onSessionError: (sessionId, error) => {
        console.error(`[App] Session ${sessionId} error:`, error);
        setActiveJob((prev) =>
          prev && prev.sessionId === sessionId ? null : prev
        );
        setPendingQueue((prev) => {
          const target = prev.find((j) => j.sessionId === sessionId);
          if (target) {
            target.files.forEach((f) => {
              (f as { buffer: ArrayBuffer | null }).buffer = new ArrayBuffer(0);
            });
          }
          return prev.filter((j) => j.sessionId !== sessionId);
        });
        setRecentJobs((prev) =>
          prev.map((j) =>
            j.sessionId === sessionId
              ? { ...j, status: "error", detail: error }
              : j
          )
        );
        try {
          const supabase = getSupabase();
          supabase
            .from("print_orders")
            .update({ status: "failed" })
            .eq("session_id", sessionId)
            .then(() => {});
          if (shopId) {
            supabase
              .rpc("refund_shop_token", {
                p_shop_id: shopId,
                p_session_id: sessionId,
              })
              .then(() => {});
          }
        } catch {}
      },
    });

    signalingChannelRef.current = channel;

    return () => {
      console.log(`[App] Tearing down signaling channel...`);
      signalingChannelRef.current = null;
      stopShopSignaling(channel);
      setIsListening(false);
    };
  }, [isAuthenticated, shopId, isShopOnline, loadTodayPrintsCount, refreshAssignments]);

  // Auto-expire unpaid pendingQueue jobs older than 30 minutes to free V8 ArrayBuffer memory
  useEffect(() => {
    const EXPIRY_MS = 30 * 60 * 1000;
    const timer = setInterval(() => {
      const now = Date.now();
      setPendingQueue((prev) => {
        const expired = prev.filter(
          (job) => now - new Date(job.enqueuedAt).getTime() > EXPIRY_MS
        );
        if (expired.length === 0) return prev;

        expired.forEach((job) => {
          console.log(`[App] Auto-expiring abandoned unpaid order ${job.sessionId}`);
          job.files.forEach((f) => {
            (f as { buffer: ArrayBuffer | null }).buffer = new ArrayBuffer(0);
          });
          const supabase = getSupabase();
          supabase
            .from("print_orders")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("session_id", job.sessionId)
            .then(() => {});
          if (shopId) {
            supabase
              .rpc("refund_shop_token", {
                p_shop_id: shopId,
                p_session_id: job.sessionId,
              })
              .then(() => {});
          }
        });

        return prev.filter(
          (job) => now - new Date(job.enqueuedAt).getTime() <= EXPIRY_MS
        );
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, [shopId]);

  // Payment Confirmation Handler called from LiveDashboard (StrictMode-safe)
  const handleConfirmPayment = useCallback(
    async (sessionId: string) => {
      console.log(`[App] Confirming payment and enqueuing for session ${sessionId}...`);
      addBoundedSet(confirmedPaymentSessionsRef.current, sessionId);
      fifoDispatcherRef.current?.updateJobPaymentStatus(
        sessionId,
        "confirmed",
        assignmentsRef.current
      );

      let matchedJob: QueuedPrintJob | undefined;
      setPendingQueue((prev) => {
        const idx = prev.findIndex((j) => j.sessionId === sessionId);
        if (idx === -1) return prev;
        matchedJob = { ...prev[idx], paymentStatus: "confirmed" };
        return prev.filter((_, i) => i !== idx);
      });

      if (matchedJob) {
        fifoDispatcherRef.current?.enqueue(matchedJob, assignmentsRef.current);
      }

      setActiveJob((prev) => {
        if (!prev || prev.sessionId !== sessionId) return prev;
        return {
          ...prev,
          paymentStatus: "confirmed",
          paymentConfirmedAt: new Date(),
        };
      });

      setRecentJobs((prev) =>
        prev.map((job) =>
          job.sessionId === sessionId
            ? {
                ...job,
                paymentStatus: "confirmed",
                paymentConfirmedAt: new Date(),
              }
            : job
        )
      );

      const targetJob =
        (activeJobRef.current?.sessionId === sessionId ? activeJobRef.current : null) ||
        recentJobsRef.current.find((j) => j.sessionId === sessionId);

      if (signalingChannelRef.current) {
        try {
          await broadcastPaymentConfirmed(
            signalingChannelRef.current,
            sessionId,
            targetJob?.tokenCode
          );
        } catch (err) {
          console.warn("[App] Error broadcasting payment confirmation:", err);
        }
      }

      try {
        const supabase = getSupabase();
        await supabase
          .from("print_orders")
          .update({
            payment_status: "confirmed",
            status: "picked_up",
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId);
      } catch (err) {
        console.warn("[App] Error updating print_orders in Supabase:", err);
      }
    },
    []
  );

  // Cancel Order Handler (Releases ArrayBuffers & Refunds Escrowed Shop Token)
  const handleCancelOrder = useCallback(
    async (sessionId: string) => {
      console.log(`[App] Cancelling order for session ${sessionId}...`);

      setPendingQueue((prev) => {
        const target = prev.find((j) => j.sessionId === sessionId);
        if (target) {
          target.files.forEach((f) => {
            (f as { buffer: ArrayBuffer | null }).buffer = new ArrayBuffer(0);
          });
        }
        return prev.filter((j) => j.sessionId !== sessionId);
      });

      fifoDispatcherRef.current?.cancelJob(sessionId, assignmentsRef.current);
      setActiveJob((prev) => (prev?.sessionId === sessionId ? null : prev));
      setRecentJobs((prev) =>
        prev.map((job) =>
          job.sessionId === sessionId ? { ...job, status: "cancelled" } : job
        )
      );

      if (signalingChannelRef.current) {
        try {
          await broadcastOrderStatus(signalingChannelRef.current, {
            sessionId,
            status: "cancelled",
          });
        } catch (err) {
          console.warn("[App] Error broadcasting cancel status to customer:", err);
        }
      }

      try {
        const supabase = getSupabase();
        await supabase
          .from("print_orders")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId);

        if (shopId) {
          await supabase.rpc("refund_shop_token", {
            p_shop_id: shopId,
            p_session_id: sessionId,
          });
        }
      } catch (err) {
        console.warn("[App] Error cancelling print_orders or refunding token:", err);
      }
    },
    [shopId]
  );

  // Retry Failed Print Job Handler called from LiveDashboard
  const handleRetryJob = useCallback(
    (sessionId: string) => {
      if (!fifoDispatcherRef.current || !shopId) return;
      refreshAssignments(shopId);
      const success = fifoDispatcherRef.current.retryJob(sessionId, assignmentsRef.current);
      if (success) {
        console.log(`[App] Retrying failed print job: ${sessionId}`);
        setActiveJob((prev) => {
          if (prev && prev.sessionId === sessionId) {
            return {
              ...prev,
              status: "printing",
              detail: "Retrying print job on hardware spooler...",
            };
          }
          const jobInRecent = recentJobsRef.current.find((j) => j.sessionId === sessionId);
          if (jobInRecent) {
            return {
              ...jobInRecent,
              status: "printing",
              detail: "Retrying print job on hardware spooler...",
            };
          }
          return prev;
        });

        setRecentJobs((prev) =>
          prev.map((j) =>
            j.sessionId === sessionId
              ? {
                  ...j,
                  status: "printing",
                  detail: "Retrying print job on hardware spooler...",
                }
              : j
          )
        );
      }
    },
    [shopId, refreshAssignments]
  );

  // Dismiss Failed Job Handler
  const handleDismissJob = useCallback(
    (sessionId: string) => {
      fifoDispatcherRef.current?.dismissFailedJob(sessionId);
      setActiveJob((prev) => (prev?.sessionId === sessionId ? null : prev));
      setRecentJobs((prev) =>
        prev.map((j) =>
          j.sessionId === sessionId
            ? { ...j, status: "error", detail: "Dismissed by counter operator" }
            : j
        )
      );

      // Explicitly notify customer side now that the shop has dismissed/closed the job
      if (signalingChannelRef.current) {
        broadcastOrderStatus(signalingChannelRef.current, {
          sessionId,
          status: "error",
          errorDetail: "The print could not be completed at the counter. Please retry your print.",
        }).catch((err) => console.warn("[App] Error broadcasting error on dismiss:", err));
      }

      try {
        const supabase = getSupabase();
        supabase
          .from("print_orders")
          .update({ status: "failed" })
          .eq("session_id", sessionId)
          .then(() => {});
      } catch {}
    },
    []
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className="login-container"
        style={{
          flexDirection: "column",
          gap: 16,
          color: "var(--text-secondary)",
          fontSize: 14,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #16181D",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.04em" }}>
          Initializing Terminal...
        </div>
      </div>
    );
  }

  // Unauthenticated -> Login page
  if (!isAuthenticated) {
    return <Login />;
  }

  // Authenticated -> Full Shop Admin Shell
  return (
    <div className={`app-shell ${!isSidebarOpen ? "sidebar-collapsed" : ""}`}>
      {isSidebarOpen && (
        <Sidebar
          currentPage={currentPage}
          onSelectPage={handleSelectPage}
          isOnline={isShopOnline}
          onToggleOnline={handleToggleOnline}
          isTogglingOnline={isTogglingOnline}
          onLogoutRequest={handleLogoutRequest}
          onHideSidebar={() => setIsSidebarOpen(false)}
          tokenBalance={tokenBalance}
          tokenAlert={tokenAlert}
        />
      )}

      <div className="main-workspace">
        <div className="window-drag-strip">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="no-drag sidebar-toggle-btn"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              title={isSidebarOpen ? "Hide sidebar (Alt+S)" : "Show sidebar (Alt+S)"}
              aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <IconSidebarToggle size={15} />
              <span className="sidebar-toggle-text">{isSidebarOpen ? "Hide Menu" : "Show Menu"}</span>
            </button>

            <div className="window-drag-title">
              <span style={{ fontWeight: 700, color: "#09090b" }}>Printap</span>
              <span style={{ color: "var(--text-faint)" }}>•</span>
              <span style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>
                {currentPage === "live"
                  ? "Live Monitor"
                  : currentPage === "history"
                  ? "Print History"
                  : currentPage === "printers"
                  ? "Printers Control"
                  : currentPage === "services"
                  ? "Services & Rates"
                  : currentPage === "analytics"
                  ? "Revenue & Analytics"
                  : currentPage === "qr"
                  ? "Counter QR Stand"
                  : currentPage === "tokens"
                  ? "Token Management"
                  : "Shop Profile"}
              </span>
            </div>
          </div>
          <div
            className="no-drag"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 500,
              color:
                isShopOnline && isListening
                  ? "var(--accent-emerald)"
                  : "var(--text-muted)",
            }}
          >
            <span
              className={`beacon-dot ${
                isShopOnline && isListening ? "online" : "offline"
              }`}
              role="status"
              aria-label={
                isShopOnline && isListening
                  ? "Shop Online • P2P Active"
                  : "Shop Offline (Standby)"
              }
              style={{
                background:
                  isShopOnline && isListening
                    ? "var(--accent-emerald)"
                    : "var(--text-muted)",
                boxShadow:
                  isShopOnline && isListening
                    ? "0 0 8px rgba(16, 185, 129, 0.4)"
                    : "none",
              }}
            />
            <span>
              {isShopOnline
                ? isListening
                  ? "Shop Online • P2P Active"
                  : "Connecting P2P..."
                : "Shop Offline (Standby)"}
            </span>
          </div>
        </div>

        <main style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          <div
            style={{
              display: currentPage === "live" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <LiveDashboard
              currentJob={activeJob}
              recentJobs={recentJobs}
              pendingQueue={pendingQueue}
              todayPrintsCount={todayPrintsCount}
              isListening={isListening}
              connectedPrintersCount={
                printers.filter((p) => p.isPhysical && p.isOnline).length
              }
              onConfirmPayment={handleConfirmPayment}
              onCancelOrder={handleCancelOrder}
              onRetryJob={handleRetryJob}
              onDismissJob={handleDismissJob}
              onNavigateToHistory={() => handleSelectPage("history")}
              tokenBalance={tokenBalance}
              tokenAlert={tokenAlert}
            />
          </div>

          {currentPage === "history" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
              <PrintHistory recentJobs={recentJobs} />
            </div>
          )}

          {currentPage === "printers" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
              <PrintersControl
                printers={printers}
                isLoadingPrinters={isLoadingPrinters}
                onRescanPrinters={rescanPrinters}
                onAssignmentsSaved={(newAssignments) => {
                  assignmentsRef.current = newAssignments;
                }}
                onRegisterDirtyHandler={(handler) => {
                  dirtyHandlersRef.current["printers"] = handler;
                }}
              />
            </div>
          )}

          {currentPage === "services" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
              <ServicesRates
                onRegisterDirtyHandler={(handler) => {
                  dirtyHandlersRef.current["services"] = handler;
                }}
              />
            </div>
          )}

          {currentPage === "analytics" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
              <Analytics />
            </div>
          )}

          {currentPage === "qr" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
              <CounterQr />
            </div>
          )}

          {currentPage === "tokens" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
              <Tokens />
            </div>
          )}

          {currentPage === "profile" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
              <Profile
                onNavigateToQr={() => handleSelectPage("qr")}
                isTerminalOnline={isShopOnline}
              />
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#18181b",
            color: "#f4f4f5",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <UnsavedChangesModal
        isOpen={Boolean(unsavedModal?.isOpen)}
        pageName={unsavedModal?.pageName || ""}
        isSaving={isSavingUnsaved}
        onCancel={handleCancelNavigation}
        onDiscard={handleDiscardAndContinue}
        onSave={handleSaveAndContinue}
      />
    </div>
  );
}

export default function App(): React.ReactElement {
  const [updateState, setUpdateState] = useState<{
    stage: "checking" | "available" | "downloading" | "downloaded" | "error" | "not-available" | null;
    progress?: number;
    error?: string;
    version?: string;
  }>({ stage: "checking" });

  const [startupCheckDone, setStartupCheckDone] = useState(false);

  useEffect(() => {
    let checkTimeout: NodeJS.Timeout | null = null;

    if (window.electronAPI?.onUpdaterEvent) {
      const cleanup = window.electronAPI.onUpdaterEvent((data) => {
        console.log("[App] Updater event:", data.stage, data);
        setUpdateState((prev) => ({
          ...prev,
          stage: data.stage as any,
          progress: data.progress,
          error: data.error,
          version: (data.info as any)?.version || prev.version,
        }));

        if (data.stage === "not-available") {
          // Terminal is on the latest release; proceed to load the app
          if (checkTimeout) clearTimeout(checkTimeout);
          setStartupCheckDone(true);
        } else if (data.stage === "error") {
          // Network error or offline during initial check; proceed so offline counter is not blocked
          if (checkTimeout) clearTimeout(checkTimeout);
          console.warn("[App] Updater error on startup check:", data.error);
          setStartupCheckDone(true);
        } else if (data.stage === "available") {
          // Mandatory update available; cancel safety timer and intercept app loading
          if (checkTimeout) clearTimeout(checkTimeout);
          setStartupCheckDone(false);
        }
      });

      // Safety timeout: if after 4.5 seconds no event resolved (e.g. slow network), proceed to app
      checkTimeout = setTimeout(() => {
        setStartupCheckDone((done) => {
          if (!done) {
            console.log("[App] Startup update check timed out; proceeding to app");
            return true;
          }
          return done;
        });
      }, 4500);

      return () => {
        cleanup();
        if (checkTimeout) clearTimeout(checkTimeout);
      };
    } else {
      setStartupCheckDone(true);
    }
  }, []);

  const isMandatoryUpdateActive =
    updateState.stage === "available" ||
    updateState.stage === "downloading" ||
    updateState.stage === "downloaded" ||
    (updateState.stage === "error" && !startupCheckDone);

  // Initial startup screen: checking for updates before loading the counter terminal
  if (!startupCheckDone && !isMandatoryUpdateActive) {
    return (
      <div
        className="login-container"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          backgroundColor: "#F0EBED",
          gap: 16,
          userSelect: "none",
        }}
      >
        <div
          className="login-brand-icon"
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: "#16181D",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          }}
        >
          <span style={{ fontSize: 24, color: "#fff", fontWeight: 700 }}>P</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#16181D",
              fontFamily: "var(--font-sans)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Printap
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 6,
              fontFamily: "var(--font-sans)",
            }}
          >
            Checking for updates...
          </p>
        </div>
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: "2.5px solid rgba(22, 24, 29, 0.15)",
              borderTopColor: "#16181D",
              borderRadius: "50%",
              animation: "spin 0.75s linear infinite",
            }}
          />
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 4,
            fontFamily: "var(--font-mono)",
          }}
        >
          Verifying security & release status
        </div>
      </div>
    );
  }

  // Mandatory update screen: if an update is found on startup, intercept BEFORE loading the app
  if (!startupCheckDone && isMandatoryUpdateActive) {
    return (
      <div
        className="login-container"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          backgroundColor: "#F0EBED",
          userSelect: "none",
        }}
      >
        <UpdateScreen
          stage={updateState.stage as any}
          progress={updateState.progress}
          error={updateState.error}
          version={updateState.version}
          isCompulsory={true}
          onStartDownload={() => window.electronAPI.startDownloadUpdate()}
          onRestart={() => window.electronAPI.restartApp()}
          onDismiss={() => {
            setUpdateState({ stage: null });
            setStartupCheckDone(true);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <AuthProvider>
        <ShopAdminShell />
      </AuthProvider>
      {isMandatoryUpdateActive && (
        <UpdateScreen
          stage={updateState.stage as any}
          progress={updateState.progress}
          error={updateState.error}
          version={updateState.version}
          isCompulsory={true}
          onStartDownload={() => window.electronAPI.startDownloadUpdate()}
          onRestart={() => window.electronAPI.restartApp()}
          onDismiss={() => {
            setUpdateState({ stage: null });
          }}
        />
      )}
    </>
  );
}
