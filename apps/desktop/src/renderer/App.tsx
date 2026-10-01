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
import {
  startShopSignaling,
  stopShopSignaling,
  broadcastPaymentConfirmed,
} from "./lib/shop-signaling";
import { getSupabase, setShopOnline, broadcast } from "@printap/shared";
import { startPresence, stopPresence } from "./lib/shop-presence";
import logoImg from "./assets/logo.png";

function ShopAdminShell(): React.ReactElement {
  const { isAuthenticated, isLoading, shopId, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<AdminPage>("live");

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

  // Manual or initial printer detection
  const rescanPrinters = useCallback(async () => {
    setIsLoadingPrinters(true);
    try {
      const result = await window.electronAPI.listPrinters();
      if (result.success && result.printers) {
        setPrinters(result.printers);
        try {
          localStorage.setItem("printap_cached_printers", JSON.stringify(result.printers));
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
      }

      // Also hydrate today's print_orders into recentJobs so pending payments & history remain visible
      const { data: orders } = await supabase
        .from("print_orders")
        .select("session_id, token_code, payment_method, payment_status, total_amount, status, created_at")
        .eq("shop_id", id)
        .gte("created_at", startOfToday.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (orders && orders.length > 0) {
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
      }
    } catch {
      // ignore
    }
  }, []);

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
      // On fresh launch, reset DB state to false (cleans up any previous crashes)
      // The shop owner explicitly toggles "Go Online" when ready for orders
      await setShopOnline(shopId, false);
      if (isMounted) {
        setIsShopOnline(false);
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

      onManifestReceived: (sessionId, manifestOrder) => {
        handledOrderSessions.current.add(sessionId);

        const token = manifestOrder.tokenCode;
        const amount = manifestOrder.totalAmount;
        const isAlreadyConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

        setActiveJob((prev) => ({
          ...prev,
          sessionId,
          tokenCode: token || prev?.tokenCode,
          totalAmount: amount !== undefined && amount > 0 ? amount : prev?.totalAmount,
          paymentMethod: manifestOrder.paymentMethod || prev?.paymentMethod || "upi",
          paymentStatus:
            isAlreadyConfirmed || (prev?.sessionId === sessionId && prev?.paymentStatus === "confirmed")
              ? "confirmed"
              : (manifestOrder.paymentStatus as any) || prev?.paymentStatus || "pending",
          fileCount: manifestOrder.totalFiles,
          status: "receiving",
          detail: `Receiving order ${token || ""} (${manifestOrder.totalFiles} files)...`,
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
            tokenCode: token || existing?.tokenCode,
            totalAmount: amount !== undefined && amount > 0 ? amount : existing?.totalAmount,
            paymentMethod: manifestOrder.paymentMethod || existing?.paymentMethod || "upi",
            paymentStatus: paymentConfirmed ? "confirmed" : existing?.paymentStatus || "pending",
            paymentConfirmedAt: existing?.paymentConfirmedAt,
            fileCount: manifestOrder.totalFiles,
            fileName: `Order ${token || sessionId.slice(0, 8)}`,
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
        const map = assignmentsRef.current;

        // 1. Pick target printer based on job settings (color vs bw)
        const hasColor = files.some((f) => f.settings?.colorMode === "color");
        let targetAssignment: PrinterAssignment | undefined;

        if (hasColor) {
          targetAssignment = Object.values(map).find(
            (a) => a.role === "color" || a.role === "both"
          );
        } else {
          targetAssignment = Object.values(map).find(
            (a) => a.role === "bw" || a.role === "both"
          );
        }

        if (!targetAssignment) {
          targetAssignment = Object.values(map).find(
            (a) => a.is_default && a.role !== "disabled"
          );
        }
        if (!targetAssignment) {
          targetAssignment = Object.values(map).find((a) => a.role !== "disabled") || Object.values(map)[0];
        }

        const printerNumber = targetAssignment?.printer_number || 1;
        const targetPrinter = targetAssignment?.printer_name;

        // 2. Token format: #{printerNumber}{todaySessionCount} (e.g. Printer #2, 14th print -> #214)
        const sessionNum = todayPrintsCount + 1;
        const finalTokenCode = order.tokenCode && order.tokenCode.startsWith("#")
          ? order.tokenCode
          : `#${printerNumber}${sessionNum}`;

        const finalAmount =
          order.totalAmount !== undefined && order.totalAmount > 0
            ? order.totalAmount
            : activeJob?.totalAmount !== undefined && activeJob.totalAmount > 0
            ? activeJob.totalAmount
            : 0;

        console.log(
          `[App] Order received: Token ${finalTokenCode} (₹${finalAmount}) on Printer #${printerNumber}, ${files.length} files`
        );

        const jobFiles = files.map((f) => ({
          fileName: f.fileName,
          fileSize: f.fileSize,
          pageCount: f.pageCount,
          settings: f.settings,
        }));

        const isAlreadyConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

        setActiveJob((prev) => {
          const paymentConfirmed =
            isAlreadyConfirmed ||
            (prev?.sessionId === sessionId && prev?.paymentStatus === "confirmed");
          return {
            ...prev,
            sessionId,
            tokenCode: finalTokenCode,
            fileCount: files.length,
            files: jobFiles,
            totalAmount: finalAmount,
            paymentMethod: order.paymentMethod || prev?.paymentMethod || "upi",
            paymentStatus: paymentConfirmed ? "confirmed" : prev?.paymentStatus || "pending",
            fileName:
              files.length > 1
                ? `${files.length} documents (${finalTokenCode})`
                : files[0]?.fileName,
            status: "saving",
            detail: `Token ${finalTokenCode} received (${files.length} files). Spooling to Printer #${printerNumber}...`,
            timestamp: prev?.timestamp || new Date(),
          };
        });

        // Broadcast confirmed token to customer via signaling
        if (signalingChannelRef.current) {
          try {
            await broadcast(signalingChannelRef.current, "order-status", {
              sessionId,
              tokenCode: finalTokenCode,
              paymentStatus: isAlreadyConfirmed ? "confirmed" : "pending",
            });
          } catch {}
        }

        // Update token_code in Supabase print_orders
        try {
          const supabase = getSupabase();
          await supabase
            .from("print_orders")
            .update({ token_code: finalTokenCode })
            .eq("session_id", sessionId);
        } catch {}

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const settings = file.settings;

          setActiveJob((prev) => ({
            ...prev!,
            status: "printing",
            detail: `Printing ${i + 1}/${files.length}: ${file.fileName} (${settings.copies} copy, ${settings.colorMode.toUpperCase()}) on ${targetPrinter || "default printer"}`,
          }));

          try {
            await window.electronAPI.printPdf(file.buffer, sessionId, {
              printer: targetPrinter,
              copies: settings.copies,
              orientation: settings.orientation,
              scale: settings.pageFit === "fill" ? "noscale" : "fit",
            });
          } catch (err) {
            console.error(`[App] Error printing file ${file.fileName}:`, err);
          }
        }

        // Record print event in Supabase ledger
        try {
          const supabase = getSupabase();
          await supabase.from("print_events").insert({
            shop_id: shopId,
            session_id: sessionId,
            fee_amount: 1.0,
          });
        } catch (err) {
          console.warn("[App] Could not insert print_event:", err);
        }

        const isConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

        setRecentJobs((prev) => {
          const existing = prev.find((j) => j.sessionId === sessionId);
          const paymentConfirmed =
            isConfirmed ||
            existing?.paymentStatus === "confirmed";

          if (paymentConfirmed) {
            confirmedPaymentSessionsRef.current.add(sessionId);
          }

          const completedJob: LiveJob = {
            sessionId,
            tokenCode: finalTokenCode,
            fileCount: files.length,
            files: jobFiles,
            totalAmount: finalAmount,
            paymentMethod: order.paymentMethod || existing?.paymentMethod || "upi",
            paymentStatus: paymentConfirmed ? "confirmed" : existing?.paymentStatus || "pending",
            paymentConfirmedAt: existing?.paymentConfirmedAt || (paymentConfirmed ? new Date() : undefined),
            fileName:
              files.length > 1
                ? `${files.length} documents`
                : files[0]?.fileName,
            status: "done",
            detail: `Token ${finalTokenCode} — ${files.length} file(s) printed & shredded`,
            timestamp: existing?.timestamp || new Date(),
          };

          const filtered = prev.filter((j) => j.sessionId !== sessionId);
          return [completedJob, ...filtered.slice(0, 19)];
        });
        setTodayPrintsCount((c) => c + files.length);

        setActiveJob((prev) => {
          if (!prev) return null;
          const paymentConfirmed = isConfirmed || prev.paymentStatus === "confirmed";
          return {
            ...prev,
            tokenCode: finalTokenCode,
            totalAmount: finalAmount,
            paymentStatus: paymentConfirmed ? "confirmed" : prev.paymentStatus,
            status: "done",
            detail: `Order ${finalTokenCode} complete! Paper ready on tray.`,
          };
        });

        setTimeout(() => {
          setActiveJob((prev) =>
            prev?.sessionId === sessionId ? null : prev
          );
        }, 5000);
      },

      onFileReceived: async (sessionId, buffer, fileName) => {
        // If this session was already handled as a multi-file order, skip
        if (handledOrderSessions.current.has(sessionId)) {
          return;
        }

        console.log(
          `[App] Legacy file received: ${fileName || sessionId}, bytes: ${buffer.byteLength}`
        );

        const singleFile = [
          {
            fileName: fileName || "Document.pdf",
            fileSize: buffer.byteLength,
            pageCount: 1,
          },
        ];

        const isLegacyConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

        setActiveJob((prev) => {
          const paymentConfirmed =
            isLegacyConfirmed ||
            (prev?.sessionId === sessionId && prev?.paymentStatus === "confirmed");
          return {
            ...prev,
            sessionId,
            fileName: fileName || prev?.fileName,
            fileCount: 1,
            files: singleFile,
            tokenCode: prev?.tokenCode || "#11",
            totalAmount:
              prev?.totalAmount !== undefined && prev.totalAmount > 0
                ? prev.totalAmount
                : 5,
            paymentMethod: prev?.paymentMethod || "cash",
            paymentStatus: paymentConfirmed ? "confirmed" : prev?.paymentStatus || "pending",
            status: "saving",
            detail: "PDF received, forwarding to printer driver...",
            timestamp: prev?.timestamp || new Date(),
          };
        });

        // Determine destination printer from assignments
        refreshAssignments(shopId);
        const map = assignmentsRef.current;
        let targetPrinter: string | undefined = undefined;

        // Check for an explicit default or first active printer
        const defaultAssignment = Object.values(map).find(
          (a) => a.is_default && a.role !== "disabled"
        );
        if (defaultAssignment) {
          targetPrinter = defaultAssignment.printer_name;
        } else {
          const firstActive = Object.values(map).find(
            (a) => a.role !== "disabled"
          );
          if (firstActive) {
            targetPrinter = firstActive.printer_name;
          }
        }

        try {
          const result = await window.electronAPI.printPdf(buffer, sessionId, {
            printer: targetPrinter,
            copies: 1,
          });

          if (result.success) {
            // Record print event in Supabase ledger
            try {
              const supabase = getSupabase();
              await supabase.from("print_events").insert({
                shop_id: shopId,
                session_id: sessionId,
                fee_amount: 1.0,
              });
            } catch (err) {
              console.warn("[App] Could not insert print_event:", err);
            }

            const isConfirmed = confirmedPaymentSessionsRef.current.has(sessionId);

            setRecentJobs((prev) => {
              const existing = prev.find((j) => j.sessionId === sessionId);
              const paymentConfirmed =
                isConfirmed ||
                existing?.paymentStatus === "confirmed";

              if (paymentConfirmed) {
                confirmedPaymentSessionsRef.current.add(sessionId);
              }

              const completedJob: LiveJob = {
                sessionId,
                tokenCode: existing?.tokenCode || "#11",
                totalAmount:
                  existing?.totalAmount !== undefined && existing.totalAmount > 0
                    ? existing.totalAmount
                    : 5,
                paymentMethod: existing?.paymentMethod || "cash",
                paymentStatus: paymentConfirmed ? "confirmed" : existing?.paymentStatus || "pending",
                paymentConfirmedAt: existing?.paymentConfirmedAt || (paymentConfirmed ? new Date() : undefined),
                fileName: fileName || existing?.fileName || `Print #${sessionId.slice(0, 8)}`,
                status: "done",
                detail: `Printed on ${targetPrinter || "default printer"} & shredded`,
                timestamp: existing?.timestamp || new Date(),
              };

              const filtered = prev.filter((j) => j.sessionId !== sessionId);
              return [completedJob, ...filtered.slice(0, 19)];
            });
            setTodayPrintsCount((c) => c + 1);

            // Keep "Completed" visible for 3 seconds then return to idle
            setActiveJob((prev) => {
              if (!prev) return null;
              const paymentConfirmed = isConfirmed || prev.paymentStatus === "confirmed";
              return {
                ...prev,
                paymentStatus: paymentConfirmed ? "confirmed" : prev.paymentStatus,
                status: "done",
                detail: "Job completed & shredded safely",
              };
            });
            setTimeout(() => {
              setActiveJob((prev) => (prev?.sessionId === sessionId ? null : prev));
            }, 3500);
          } else {
            const failedJob: LiveJob = {
              sessionId,
              fileName: fileName || `Print #${sessionId.slice(0, 8)}`,
              status: "error",
              detail: result.error || "Spool failed",
              timestamp: new Date(),
            };

            setRecentJobs((prev) => {
              const filtered = prev.filter((j) => j.sessionId !== sessionId);
              return [failedJob, ...filtered.slice(0, 19)];
            });
            setActiveJob(failedJob);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const failedJob: LiveJob = {
            sessionId,
            fileName: fileName || `Print #${sessionId.slice(0, 8)}`,
            status: "error",
            detail: msg,
            timestamp: new Date(),
          };

          setRecentJobs((prev) => {
            const filtered = prev.filter((j) => j.sessionId !== sessionId);
            return [failedJob, ...filtered.slice(0, 19)];
          });
          setActiveJob(failedJob);
        }
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
    <div className="app-shell">
      <Sidebar
        currentPage={currentPage}
        onSelectPage={handleSelectPage}
        isOnline={isShopOnline}
        onToggleOnline={handleToggleOnline}
        isTogglingOnline={isTogglingOnline}
        onLogoutRequest={handleLogoutRequest}
      />

      <div className="main-workspace">
        <div className="window-drag-strip">
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
