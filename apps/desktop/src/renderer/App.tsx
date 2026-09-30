import React, { useState, useEffect, useCallback, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Sidebar, type AdminPage } from "./components/Sidebar";
import { Login } from "./components/Login";
import { LiveDashboard, type LiveJob } from "./components/LiveDashboard";
import { Profile } from "./components/Profile";
import { PrintersControl, type PrinterAssignment } from "./components/PrintersControl";
import { ServicesRates } from "./components/ServicesRates";
import { Analytics } from "./components/Analytics";
import { CounterQr } from "./components/CounterQr";
import {
  startShopSignaling,
  stopShopSignaling,
} from "./lib/shop-signaling";
import { getSupabase, setShopOnline } from "@printap/shared";
import { startPresence, stopPresence } from "./lib/shop-presence";

function ShopAdminShell(): React.ReactElement {
  const { isAuthenticated, isLoading, shopId } = useAuth();
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

  // Ref to hold current assignments for printer routing
  const assignmentsRef = useRef<Record<string, PrinterAssignment>>({});
  // Track handled order sessions to avoid duplicate processing with legacy onFileReceived
  const handledOrderSessions = useRef<Set<string>>(new Set());

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

  // 2. Fetch today's print count from Supabase when shopId is loaded
  const loadTodayPrintsCount = useCallback(async (id: string) => {
    try {
      const supabase = getSupabase();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from("print_events")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", id)
        .gte("created_at", startOfToday.toISOString());

      if (!error && typeof count === "number") {
        setTodayPrintsCount(count);
      }
    } catch (e) {
      console.warn("[App] Could not load today's count:", e);
    }
  }, []);

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
        setActiveJob({
          sessionId,
          status: "receiving",
          progressPct: 0,
          timestamp: new Date(),
        });
      },

      onFileProgress: (sessionId, fileName, pct, _received, _total, fileIndex, totalFiles) => {
        setActiveJob((prev) => ({
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

        console.log(
          `[App] Order received: ${order.tokenCode}, PIN: ${order.pickupPin}, ${files.length} files`
        );

        setActiveJob({
          sessionId,
          tokenCode: order.tokenCode,
          pickupPin: order.pickupPin,
          fileCount: files.length,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          fileName:
            files.length > 1
              ? `${files.length} documents (${order.tokenCode})`
              : files[0]?.fileName,
          status: "saving",
          detail: `Order ${order.tokenCode} received (${files.length} files). Spooling...`,
          timestamp: new Date(),
        });

        refreshAssignments(shopId);
        const map = assignmentsRef.current;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const settings = file.settings;

          // Intelligently select printer based on color setting
          let targetPrinter: string | undefined = undefined;
          if (settings.colorMode === "color") {
            const colorPrinter = Object.values(map).find(
              (a) => a.role === "color"
            );
            if (colorPrinter) targetPrinter = colorPrinter.printer_name;
          } else if (settings.colorMode === "bw") {
            const bwPrinter = Object.values(map).find(
              (a) => a.role === "bw"
            );
            if (bwPrinter) targetPrinter = bwPrinter.printer_name;
          }

          if (!targetPrinter) {
            const defaultAssignment = Object.values(map).find(
              (a) => a.is_default && a.role !== "disabled"
            );
            targetPrinter = defaultAssignment?.printer_name;
          }

          if (!targetPrinter) {
            const firstActive = Object.values(map).find(
              (a) => a.role !== "disabled"
            );
            targetPrinter = firstActive?.printer_name;
          }

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

        const completedJob: LiveJob = {
          sessionId,
          tokenCode: order.tokenCode,
          pickupPin: order.pickupPin,
          fileCount: files.length,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          fileName:
            files.length > 1
              ? `${files.length} documents`
              : files[0]?.fileName,
          status: "done",
          detail: `Token ${order.tokenCode} (PIN: ${order.pickupPin}) — ${files.length} file(s) printed & shredded`,
          timestamp: new Date(),
        };

        setRecentJobs((prev) => [completedJob, ...prev.slice(0, 19)]);
        setTodayPrintsCount((c) => c + files.length);

        setActiveJob((prev) =>
          prev
            ? {
                ...prev,
                status: "done",
                detail: `Order ${order.tokenCode} complete! Customer PIN: ${order.pickupPin}`,
              }
            : null
        );

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

        setActiveJob((prev) => ({
          sessionId,
          fileName: fileName || prev?.fileName,
          status: "saving",
          detail: "PDF received, forwarding to printer driver...",
          timestamp: prev?.timestamp || new Date(),
        }));

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

            const completedJob: LiveJob = {
              sessionId,
              fileName: fileName || `Print #${sessionId.slice(0, 8)}`,
              status: "done",
              detail: `Printed on ${targetPrinter || "default printer"} & shredded`,
              timestamp: new Date(),
            };

            setRecentJobs((prev) => [completedJob, ...prev.slice(0, 19)]);
            setTodayPrintsCount((c) => c + 1);

            // Keep "Completed" visible for 3 seconds then return to idle
            setActiveJob((prev) =>
              prev
                ? {
                    ...prev,
                    status: "done",
                    detail: "Job completed & shredded safely",
                  }
                : null
            );
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

            setRecentJobs((prev) => [failedJob, ...prev.slice(0, 19)]);
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
          setRecentJobs((prev) => [failedJob, ...prev.slice(0, 19)]);
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

    return () => {
      console.log(`[App] Tearing down signaling channel...`);
      stopShopSignaling(channel);
      setIsListening(false);
    };
  }, [isAuthenticated, shopId, isShopOnline, loadTodayPrintsCount, refreshAssignments]);

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
        <div style={{ fontSize: 32 }}>🖨️</div>
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
        onSelectPage={setCurrentPage}
        isOnline={isShopOnline}
        onToggleOnline={handleToggleOnline}
        isTogglingOnline={isTogglingOnline}
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
            />
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
            <ServicesRates />
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
            <Profile onNavigateToQr={() => setCurrentPage("qr")} />
          </div>
        </main>
      </div>
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
