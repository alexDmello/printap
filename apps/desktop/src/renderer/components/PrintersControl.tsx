import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { getSupabase } from "@printap/shared";
import {
  IconPrinter,
  IconUsb,
  IconNetwork,
  IconWifi,
  IconRefresh,
  IconCheck,
} from "./Icons";

export type PrinterRole = "bw" | "color" | "both" | "disabled";

import type { DirtyHandler } from "./ServicesRates";

export interface PrinterAssignment {
  id?: string;
  shop_id: string;
  printer_name: string;
  printer_number: number;
  role: PrinterRole;
  is_default: boolean;
  is_active: boolean;
}

export interface PrintersControlProps {
  printers?: PrinterInfo[];
  isLoadingPrinters?: boolean;
  onRescanPrinters?: () => Promise<void>;
  onAssignmentsSaved?: (assignments: Record<string, PrinterAssignment>) => void;
  onRegisterDirtyHandler?: (handler: DirtyHandler | null) => void;
}

export const PrintersControl: React.FC<PrintersControlProps> = ({
  printers: externalPrinters,
  isLoadingPrinters: externalIsLoading,
  onRescanPrinters,
  onAssignmentsSaved,
  onRegisterDirtyHandler,
}) => {
  const { shopId } = useAuth();
  const [internalPrinters, setInternalPrinters] = useState<PrinterInfo[]>([]);
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, PrinterAssignment>>({});
  const [activeTab, setActiveTab] = useState<"physical" | "all">("physical");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Initial snapshot to track unsaved edits
  const initialAssignmentsRef = React.useRef<string>("");

  const printers = externalPrinters !== undefined ? externalPrinters : internalPrinters;
  const isLoading = externalIsLoading !== undefined ? externalIsLoading : internalIsLoading;

  const getStorageKey = useCallback(
    () => `printap_printers_${shopId || "default"}`,
    [shopId]
  );

  // Load assignments from Supabase or localStorage
  const loadAssignments = useCallback(async () => {
    if (!shopId) return;

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("printer_assignments")
        .select("*")
        .eq("shop_id", shopId);

      if (!error && data && data.length > 0) {
        const map: Record<string, PrinterAssignment> = {};
        data.forEach((item, idx) => {
          map[item.printer_name] = {
            ...item,
            printer_number: item.printer_number || (idx + 1),
          };
        });
        setAssignments(map);
        initialAssignmentsRef.current = JSON.stringify(map);
        localStorage.setItem(getStorageKey(), JSON.stringify(map));
        return;
      }
    } catch {
      // Supabase table not created yet, fall back to local storage
    }

    const cached = localStorage.getItem(getStorageKey());
    if (cached) {
      try {
        const map = JSON.parse(cached);
        Object.keys(map).forEach((k, idx) => {
          if (!map[k].printer_number) {
            map[k].printer_number = idx + 1;
          }
        });
        setAssignments(map);
        initialAssignmentsRef.current = JSON.stringify(map);
      } catch {
        // ignore
      }
    }
  }, [shopId, getStorageKey]);

  // Manual Discover OS printers (only triggered when user clicks Rescan)
  const handleManualRescan = useCallback(async () => {
    setStatusMessage(null);
    if (onRescanPrinters) {
      await onRescanPrinters();
      return;
    }
    setInternalIsLoading(true);
    try {
      const result = await window.electronAPI.listPrinters();
      if (result.success && result.printers) {
        setInternalPrinters(result.printers);
      } else {
        setStatusMessage({
          text: result.error || "No printers detected by Windows.",
          type: "error",
        });
      }
    } catch (err) {
      setStatusMessage({
        text: `Printer scan failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        type: "error",
      });
    } finally {
      setInternalIsLoading(false);
    }
  }, [onRescanPrinters]);

  // Load assignments once on mount — DO NOT auto-scan printers here
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // When printers list is available, register missing assignments
  useEffect(() => {
    if (!printers || printers.length === 0) return;
    setAssignments((prev) => {
      let hasChanges = false;
      const next = { ...prev };
      printers.forEach((p, idx) => {
        if (!next[p.name]) {
          hasChanges = true;
          next[p.name] = {
            shop_id: shopId || "",
            printer_name: p.name,
            printer_number: idx + 1,
            role: p.isPhysical ? (idx === 0 ? "both" : "bw") : "disabled",
            is_default: p.isPhysical && (idx === 0 || p.isDefault),
            is_active: p.isPhysical,
          };
        } else if (!next[p.name].printer_number) {
          hasChanges = true;
          next[p.name].printer_number = idx + 1;
        }
      });
      if (hasChanges) {
        if (!initialAssignmentsRef.current) {
          initialAssignmentsRef.current = JSON.stringify(next);
        }
        return next;
      }
      return prev;
    });
  }, [printers, shopId]);

  const physicalPrinters = useMemo(
    () => printers.filter((p) => p.isPhysical),
    [printers]
  );

  const virtualPrinters = useMemo(
    () => printers.filter((p) => !p.isPhysical),
    [printers]
  );

  const displayedPrinters = useMemo(
    () => (activeTab === "all" ? printers : physicalPrinters),
    [activeTab, printers, physicalPrinters]
  );

  const handlePrinterNumberChange = (printerName: string, num: number) => {
    setAssignments((prev) => ({
      ...prev,
      [printerName]: {
        ...(prev[printerName] || {
          shop_id: shopId || "",
          printer_name: printerName,
          is_default: false,
          is_active: true,
          role: "both",
          printer_number: 1,
        }),
        printer_number: Math.max(1, Math.min(99, num)),
      },
    }));
  };

  const handleRoleChange = (printerName: string, role: PrinterRole) => {
    setAssignments((prev) => ({
      ...prev,
      [printerName]: {
        ...(prev[printerName] || {
          shop_id: shopId || "",
          printer_name: printerName,
          is_default: false,
          is_active: true,
          printer_number: 1,
        }),
        role,
        is_active: role !== "disabled",
      },
    }));
  };

  const handleToggleDefault = (printerName: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      const current = !!next[printerName]?.is_default;
      Object.keys(next).forEach((key) => {
        next[key] = {
          ...next[key],
          is_default: key === printerName ? !current : false,
        };
      });
      return next;
    });
  };

  // Check if assignments have unsaved modifications
  const isDirty = () => {
    if (!initialAssignmentsRef.current) return false;
    return JSON.stringify(assignments) !== initialAssignmentsRef.current;
  };

  // Discard edits back to baseline
  const handleDiscard = () => {
    if (!initialAssignmentsRef.current) return;
    try {
      const parsed = JSON.parse(initialAssignmentsRef.current);
      setAssignments(parsed);
      localStorage.setItem(getStorageKey(), initialAssignmentsRef.current);
      onAssignmentsSaved?.(parsed);
    } catch (e) {
      console.error("Failed to discard printer assignments", e);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    if (!shopId) return false;
    setIsSaving(true);
    setStatusMessage(null);

    localStorage.setItem(getStorageKey(), JSON.stringify(assignments));
    onAssignmentsSaved?.(assignments);

    try {
      const supabase = getSupabase();
      const records = Object.values(assignments).map((a, idx) => ({
        shop_id: shopId,
        printer_name: a.printer_name,
        printer_number: a.printer_number || (idx + 1),
        role: a.role === "disabled" ? "bw" : a.role,
        is_default: a.is_default,
        is_active: a.role !== "disabled",
      }));

      const { error } = await supabase
        .from("printer_assignments")
        .upsert(records, { onConflict: "shop_id,printer_name" });

      if (error) {
        setStatusMessage({
          text: "Saved locally! (Database sync ready)",
          type: "success",
        });
      } else {
        setStatusMessage({
          text: "Printer assignments saved successfully.",
          type: "success",
        });
      }
      initialAssignmentsRef.current = JSON.stringify(assignments);
      return true;
    } catch {
      setStatusMessage({
        text: "Saved locally in terminal storage.",
        type: "success",
      });
      initialAssignmentsRef.current = JSON.stringify(assignments);
      return true;
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Register dirty handler with parent
  useEffect(() => {
    if (!onRegisterDirtyHandler) return;
    onRegisterDirtyHandler({
      isDirty,
      save: handleSave,
      discard: handleDiscard,
      pageName: "Printers Control",
    });
    return () => {
      onRegisterDirtyHandler(null);
    };
  }, [assignments, shopId, onRegisterDirtyHandler]);

  const getConnectionDisplay = (p: PrinterInfo) => {
    switch (p.connectionType) {
      case "USB":
        return {
          icon: <IconUsb size={14} />,
          label: `USB Port: ${p.portName}`,
        };
      case "Network (TCP/IP)":
        return {
          icon: <IconNetwork size={14} />,
          label: `Network IP: ${p.hostAddress || p.portName}`,
        };
      case "Network (WSD)":
        return {
          icon: <IconWifi size={14} />,
          label: "Network WSD",
        };
      case "Network (Shared)":
        return {
          icon: <IconNetwork size={14} />,
          label: "Network Shared",
        };
      default:
        return {
          icon: <IconPrinter size={14} />,
          label: "Software Driver",
        };
    }
  };

  return (
    <div className="content fade-in">
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title">
            <span>Printers Control</span>
            <span className="status-badge active">Hardware Ready</span>
          </h1>
          <p className="page-subtitle">
            Configure connected physical Xerox & laser printers and assign Black & White vs Color queues.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleManualRescan}
            disabled={isLoading}
          >
            <IconRefresh
              size={13}
              style={{
                animation: isLoading ? "pulseDot 1s infinite linear" : "none",
              }}
            />
            <span>{isLoading ? "Scanning..." : "Rescan Printers"}</span>
          </button>
          <button
            type="button"
            className="login-btn"
            style={{ width: "auto", margin: 0, padding: "8px 18px" }}
            onClick={handleSave}
            disabled={isSaving}
          >
            <IconCheck size={14} />
            <span>{isSaving ? "Saving..." : "Save Assignments"}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={
            statusMessage.type === "success"
              ? "status-badge active"
              : "login-error"
          }
          style={{ marginBottom: 16, display: "block" }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Filter Segmented Control Bar */}
      <div className="hardware-filter-bar">
        <div className="segmented-tabs">
          <button
            type="button"
            className={`segmented-tab ${activeTab === "physical" ? "active" : ""}`}
            onClick={() => setActiveTab("physical")}
          >
            Physical Printers ({physicalPrinters.length})
          </button>
          <button
            type="button"
            className={`segmented-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All & Virtual Drivers ({printers.length})
          </button>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {physicalPrinters.length > 0 && (
            <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>
              ● {physicalPrinters.filter((p) => p.isOnline).length} Online
            </span>
          )}
          <span>•</span>
          <span>{virtualPrinters.length} Virtual drivers filtered</span>
        </div>
      </div>

      {/* Printer List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {displayedPrinters.length > 0 ? (
          displayedPrinters.map((p, idx) => {
            const assignment = assignments[p.name] || {
              shop_id: shopId || "",
              printer_name: p.name,
              printer_number: idx + 1,
              role: p.isPhysical ? ("both" as PrinterRole) : ("disabled" as PrinterRole),
              is_default: false,
              is_active: p.isPhysical,
            };

            const conn = getConnectionDisplay(p);

            return (
              <div
                key={p.name}
                className="printer-card"
                style={{
                  opacity: p.isPhysical ? 1 : 0.85,
                  border: assignment.is_default
                    ? "2px solid #09090b"
                    : "1px solid var(--border-glass)",
                }}
              >
                <div className="printer-icon-box">
                  {p.connectionType === "USB" ? (
                    <IconUsb size={20} />
                  ) : p.connectionType === "Network (TCP/IP)" ? (
                    <IconNetwork size={20} />
                  ) : p.connectionType === "Network (WSD)" ? (
                    <IconWifi size={20} />
                  ) : (
                    <IconPrinter size={20} />
                  )}
                </div>

                <div className="printer-info">
                  <div className="printer-title-row">
                    <span className="printer-name">{p.name}</span>

                    <span
                      className="status-badge"
                      style={{
                        background: "rgba(99, 102, 241, 0.12)",
                        color: "#4f46e5",
                        borderColor: "rgba(99, 102, 241, 0.25)",
                        fontSize: 11,
                        padding: "2px 8px",
                        fontWeight: 700,
                      }}
                    >
                      Printer #{assignment.printer_number ?? (idx + 1)}
                    </span>

                    <span className="chip-hardware">
                      {conn.icon}
                      <span>{conn.label}</span>
                    </span>

                    {!p.isPhysical && (
                      <span
                        className="status-badge"
                        style={{ fontSize: 10, padding: "2px 8px" }}
                      >
                        Software Driver
                      </span>
                    )}

                    {assignment.is_default && (
                      <span
                        className="status-badge"
                        style={{
                          background: "#09090b",
                          color: "#ffffff",
                          fontSize: 10,
                          padding: "2px 8px",
                          fontWeight: 600,
                        }}
                      >
                        ★ Default Printer
                      </span>
                    )}
                  </div>

                  <div className="printer-sub-row">
                    <span
                      className={`job-status-dot ${
                        !p.isPhysical
                          ? "pending"
                          : p.isOnline
                          ? "success"
                          : "error"
                      }`}
                    />
                    <span>
                      {p.isPhysical
                        ? p.isOnline
                          ? "Ready for printing"
                          : "Offline or turned off"
                        : "Virtual software queue"}
                    </span>
                    <span>•</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {p.details || "Standard queue"}
                    </span>
                  </div>
                </div>

                {/* Controls Deck */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Printer Number Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Printer No.
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>#</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={assignment.printer_number ?? (idx + 1)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handlePrinterNumberChange(p.name, isNaN(val) ? 1 : val);
                        }}
                        style={{
                          width: 44,
                          padding: "4px 6px",
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-subtle)",
                          background: "#ffffff",
                          textAlign: "center",
                          color: "#09090b",
                        }}
                        title="Printer number for tokens (e.g. Printer #2 produces tokens like #214)"
                      />
                    </div>
                  </div>

                  {/* Segmented Role Switcher Pills */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Assigned Queue
                    </span>
                    <div className="role-segmented-group">
                      {(
                        [
                          { id: "bw", label: "B&W" },
                          { id: "color", label: "Color" },
                          { id: "both", label: "Both" },
                          { id: "disabled", label: "Off" },
                        ] as const
                      ).map((roleItem) => (
                        <button
                          key={roleItem.id}
                          type="button"
                          className={`role-btn ${
                            assignment.role === roleItem.id ? "active" : ""
                          }`}
                          onClick={() => handleRoleChange(p.name, roleItem.id)}
                        >
                          {roleItem.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary Default Switch */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      alignItems: "flex-start",
                      paddingTop: 14,
                    }}
                  >
                    <div
                      className="toggle-switch-wrapper"
                      onClick={() => handleToggleDefault(p.name)}
                      title="Set as default destination for incoming prints"
                    >
                      <div
                        className={`toggle-switch ${
                          assignment.is_default ? "checked" : ""
                        }`}
                      >
                        <div className="toggle-thumb" />
                      </div>
                      <span>Default</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          /* Empty State: No Physical Machines Detected */
          <div className="idle-banner fade-in">
            <div className="idle-radar">
              <IconUsb size={24} />
            </div>

            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              No Physical Printers Detected
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginTop: 6,
                maxWidth: 460,
                margin: "6px auto 20px",
                lineHeight: 1.5,
              }}
            >
              Printap isolates virtual software drivers (such as OneNote, Microsoft Print to PDF, and disconnected COM ports). Connect your physical Xerox or laser printer to link it.
            </p>

            <div
              style={{
                display: "inline-flex",
                flexDirection: "column",
                gap: 10,
                textAlign: "left",
                background: "rgba(255, 255, 255, 0.7)",
                padding: "14px 20px",
                borderRadius: "var(--radius-lg)",
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 20,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", gap: 10 }}>
                <IconUsb size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>USB Connection:</strong> Plug in your printer’s USB cable into this PC and ensure power is turned on.
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <IconNetwork size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>Network Connection:</strong> Connect the printer to the same Wi-Fi router or switch as this PC.
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                className="login-btn"
                style={{ width: "auto", margin: 0, padding: "9px 20px" }}
                onClick={handleManualRescan}
                disabled={isLoading}
              >
                <IconRefresh size={14} />
                <span>{isLoading ? "Scanning..." : "Scan for Connected Printers"}</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setActiveTab("all")}
              >
                Show Virtual Drivers
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hardware Guidance Box */}
      <div
        className="card"
        style={{
          marginTop: 24,
          padding: 20,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 6,
          }}
        >
          About Physical Printer Detection
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          Printap queries Windows PnP hardware IDs and Port Monitors to verify physical hardware presence:
          <br />
          • <strong>Direct USB:</strong> Ports USB001–USB003 or DOT4 with IEEE 1284.4 USBPRINT device drivers.
          <br />
          • <strong>Local Network:</strong> Standard TCP/IP (TCPMON.DLL) and WSD (Web Services for Devices) on your local shop network.
          <br />
          Virtual queues and print-to-file converters are filtered automatically to ensure customer documents dispatch strictly to real paper trays.
        </p>
      </div>
    </div>
  );
};
