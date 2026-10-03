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
import logoImg from "./assets/logo.png";

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
  const [todayPrintsCount, setTodayPrintsCount] = useState<number>(0);

  // Shop Online/Offline Presence state (always starts offline on launch until toggled)
  const [isShopOnline, setIsShopOnline] = useState<boolean>(false);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);
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
  const signalingChannelRef = useRef<any>(null);
  // Track sessions where payment has been confirmed so spool completion does not overwrite it
  const confirmedPaymentSessionsRef = useRef<Set<string>>(new Set());
  // FIFO Print Dispatcher with Local Atomic Token Allocator
  const fifoDispatcherRef = useRef<FifoPrintDispatcher | null>(null);

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
            const isConfirmed = o.payment_status === "confirmed" || o.status === "picked_up";
            if (isConfirmed) {
              confirmedPaymentSessionsRef.current.add(o.session_id);
            }
            map.set(o.session_id, {
              sessionId: o.session_id,
              tokenCode: o.token_code || undefined,
              totalAmount: Number(o.total_amount) || 0,
              paymentMethod: (o.payment_method as any) || "upi",
              paymentStatus: isConfirmed ? "confirmed" : (o.payment_status as any) || "pending",
              status: o.status === "printing" ? "printing" : "done",
              detail: `Token ${o.token_code || ""}`,
              timestamp: new Date(o.created_at),
            });
          });
          prev.forEach((p) => {
            const existing = map.get(p.sessionId);
            map.set(p.sessionId, {
              ...existing,
              ...p,
              tokenCode: p.tokenCode || existing?.tokenCode,
              totalAmount:
                p.totalAmount !== undefined && p.totalAmount > 0
                  ? p.totalAmount
                  : existing?.totalAmount,
            });
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
      }).catch(() => {});
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
          confirmedPaymentSessionsRef.current.add(job.sessionId);
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

        // Broadcast hardware failure to customer phone so UI updates cleanly
        if (signalingChannelRef.current) {
          try {
            await broadcastOrderStatus(signalingChannelRef.current, {
              sessionId: job.sessionId,
              tokenCode: job.tokenCode,
              status: "error",
              errorDetail: `${error} (${printerName})`,
            });
          } catch (broadcastErr) {
            console.warn("[App] Error broadcasting failure status to customer:", broadcastErr);
          }
        }

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
        };
        setRecentJobs((prev) => {
          const filtered = prev.filter((j) => j.sessionId !== job.sessionId);
          return [failedJob, ...filtered.slice(0, 19)];
        });
        setActiveJob(failedJob);
      },
    });
  }, [shopId, todayPrintsCount]);

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

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, shopId]);

  // Graceful shutdown listener from Electron Main
  useEffect(() => {
    if (!window.electronAPI?.onAppWillQuit) return;
    const cleanup = window.electronAPI.onAppWillQuit(() => {
      console.log("[App] onAppWillQuit received, stopping presence...");
      stopPresence();
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
        handledOrderSessions.current.add(sessionId);
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
          } catch {}
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
            confirmedPaymentSessionsRef.current.add(sessionId);
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
        handledOrderSessions.current.add(sessionId);

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

        // Update Supabase print_orders token_code asynchronously
        try {
          const supabase = getSupabase();
          await supabase
            .from("print_orders")
            .update({ token_code: finalTokenCode })
            .eq("session_id", sessionId);
        } catch {}

        // Enqueue into FIFO dispatcher! Dispatcher handles multi-printer capability matching and concurrent printing.
        fifoDispatcherRef.current.enqueue(
          {
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
          },
          assignmentsRef.current
        );
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
          prev && prev.sessionId === sessionId
            ? { ...prev, status: "error", detail: error }
            : null
        );
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

  // Payment Confirmation Handler called from LiveDashboard
  const handleConfirmPayment = useCallback(
    async (sessionId: string) => {
      console.log(`[App] Confirming payment for session ${sessionId}...`);
      confirmedPaymentSessionsRef.current.add(sessionId);
      fifoDispatcherRef.current?.updateJobPaymentStatus(sessionId, "confirmed");

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
        (activeJob?.sessionId === sessionId ? activeJob : null) ||
        recentJobs.find((j) => j.sessionId === sessionId);

      // 1. Broadcast payment-confirmed event to customer over signaling channel
      if (signalingChannelRef.current) {
        try {
          await broadcastPaymentConfirmed(
            signalingChannelRef.current,
            sessionId,
            targetJob?.tokenCode
          );
          console.log(`[App] Broadcasted payment-confirmed to customer!`);
        } catch (err) {
          console.warn("[App] Error broadcasting payment confirmation:", err);
        }
      }

      // 2. Update Supabase print_orders table: marked confirmed and completed
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
    [activeJob, recentJobs]
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
          if (!prev || prev.sessionId !== sessionId) return prev;
          return {
            ...prev,
            status: "printing",
            detail: "Retrying print job on hardware spooler...",
          };
        });
      }
    },
    [shopId, refreshAssignments]
  );

  // Dismiss Failed Job Handler
  const handleDismissJob = useCallback(
    (sessionId: string) => {
      fifoDispatcherRef.current?.dismissFailedJob(sessionId);
      setActiveJob((prev) => (prev?.sessionId === sessionId ? null : prev));
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
        <img
          src={logoImg}
          alt="Printap"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            objectFit: "cover",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
          }}
        />
        <div>Initializing Printap Terminal...</div>
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
              <span style={{ fontWeight: 700, color: "#09090b" }}>Printap Agent</span>
              <span style={{ color: "var(--text-faint)" }}>•</span>
              <span style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>
                {currentPage === "live"
                  ? "Live Monitor"
                  : currentPage === "printers"
                  ? "Printers Control"
                  : currentPage === "analytics"
                  ? "Revenue & Analytics"
                  : currentPage === "qr"
                  ? "Counter QR Stand"
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
              todayPrintsCount={todayPrintsCount}
              isListening={isListening}
              connectedPrintersCount={
                printers.filter((p) => p.isPhysical && p.isOnline).length
              }
              onConfirmPayment={handleConfirmPayment}
              onRetryJob={handleRetryJob}
              onDismissJob={handleDismissJob}
              onNavigateToHistory={() => handleSelectPage("history")}
            />
          </div>

          <div
            style={{
              display: currentPage === "history" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <PrintHistory recentJobs={recentJobs} />
          </div>

          <div
            style={{
              display: currentPage === "printers" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
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

          <div
            style={{
              display: currentPage === "services" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <ServicesRates
              onRegisterDirtyHandler={(handler) => {
                dirtyHandlersRef.current["services"] = handler;
              }}
            />
          </div>

          <div
            style={{
              display: currentPage === "analytics" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <Analytics />
          </div>

          <div
            style={{
              display: currentPage === "qr" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <CounterQr />
          </div>

          <div
            style={{
              display: currentPage === "profile" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              height: "100%",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <Profile onNavigateToQr={() => handleSelectPage("qr")} />
          </div>
        </main>
      </div>

      {unsavedModal?.isOpen && (
        <div className="modal-overlay" onClick={handleCancelNavigation}>
          <div
            className="confirm-dialog-card"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-dialog-title">Unsaved Changes</div>
            <div
              className="confirm-dialog-body"
              style={{ color: "var(--text-secondary)", lineHeight: 1.5, margin: "12px 0 20px" }}
            >
              You have unsaved changes in <strong>{unsavedModal.pageName}</strong>. Would you like to save your changes before leaving this section?
            </div>
            <div className="confirm-dialog-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-dialog-cancel"
                onClick={handleCancelNavigation}
                disabled={isSavingUnsaved}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-dialog-discard"
                onClick={handleDiscardAndContinue}
                disabled={isSavingUnsaved}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn-dialog-save"
                onClick={handleSaveAndContinue}
                disabled={isSavingUnsaved}
              >
                {isSavingUnsaved ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <ShopAdminShell />
    </AuthProvider>
  );
}
