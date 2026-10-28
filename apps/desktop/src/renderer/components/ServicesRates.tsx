import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getSupabase,
  DEFAULT_SHOP_SERVICES,
  type ShopServiceItem,
  type ServiceUnit,
} from "@printap/shared";
import { IconCheck, IconTrash, IconRefresh } from "./Icons";

export interface DirtyHandler {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
  pageName: string;
}

interface ServicesRatesProps {
  onRegisterDirtyHandler?: (handler: DirtyHandler | null) => void;
}

export const ServicesRates: React.FC<ServicesRatesProps> = React.memo(({ onRegisterDirtyHandler }) => {
  const { shop, shopId, refreshShop } = useAuth();

  // Core rates
  const [priceBw, setPriceBw] = useState<number>(2);
  const [priceColor, setPriceColor] = useState<number>(10);
  const [colorEnabled, setColorEnabled] = useState<boolean>(true);

  // Services list
  const [servicesList, setServicesList] = useState<ShopServiceItem[]>(DEFAULT_SHOP_SERVICES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");

  // Initial snapshot ref to detect unsaved changes
  const initialSnapshotRef = React.useRef<string>("");

  // New Custom Service form state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState<number>(25);
  const [customUnit, setCustomUnit] = useState<ServiceUnit>("per_copy");

  // Sync state from shop data
  useEffect(() => {
    if (shop) {
      let b = 2;
      let c = 10;
      let ce = true;
      let list = DEFAULT_SHOP_SERVICES;

      if (shop.price_bw !== undefined && shop.price_bw !== null) {
        b = Number(shop.price_bw);
        setPriceBw(b);
      }
      if (shop.price_color !== undefined && shop.price_color !== null) {
        c = Number(shop.price_color);
        setPriceColor(c);
      }

      if (shop.services && Array.isArray(shop.services) && shop.services.length > 0) {
        list = shop.services;
        setServicesList(list);
        const colorItem = shop.services.find((s) => s.id === "core_color");
        if (colorItem) {
          ce = colorItem.enabled;
          setColorEnabled(ce);
        }
      } else {
        list = DEFAULT_SHOP_SERVICES.map((s) => {
          if (s.id === "core_bw" && shop.price_bw !== undefined) {
            return { ...s, price: Number(shop.price_bw) };
          }
          if (s.id === "core_color" && shop.price_color !== undefined) {
            return { ...s, price: Number(shop.price_color) };
          }
          return s;
        });
        setServicesList(list);
      }

      initialSnapshotRef.current = JSON.stringify({
        priceBw: b,
        priceColor: c,
        colorEnabled: ce,
        servicesList: list,
      });
    }
  }, [shop]);

  // Toggle active status
  const handleToggle = (id: string) => {
    if (id === "core_color") {
      setColorEnabled((prev) => !prev);
    }
    setServicesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Update item price
  const handlePriceChange = (id: string, newPrice: number) => {
    if (id === "core_bw") setPriceBw(newPrice);
    if (id === "core_color") setPriceColor(newPrice);
    setServicesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: newPrice } : s))
    );
  };

  // Add custom service
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newItem: ShopServiceItem = {
      id: "custom_" + Date.now(),
      name: customName.trim(),
      price: Number(customPrice) || 0,
      unit: customUnit,
      enabled: true,
      category: "finishing",
    };

    setServicesList((prev) => [...prev, newItem]);
    setCustomName("");
    setCustomPrice(25);
    setShowAddCustom(false);
  };

  // Delete custom service
  const handleDelete = (id: string) => {
    setServicesList((prev) => prev.filter((s) => s.id !== id));
  };

  // Discard changes back to snapshot
  const handleDiscard = () => {
    if (!initialSnapshotRef.current) return;
    try {
      const parsed = JSON.parse(initialSnapshotRef.current);
      setPriceBw(parsed.priceBw);
      setPriceColor(parsed.priceColor);
      setColorEnabled(parsed.colorEnabled);
      setServicesList(parsed.servicesList);
    } catch (e) {
      console.error("Failed to discard changes", e);
    }
  };

  // Check if current form is dirty
  const isDirty = () => {
    if (!initialSnapshotRef.current) return false;
    const currentSnapshot = JSON.stringify({
      priceBw,
      priceColor,
      colorEnabled,
      servicesList,
    });
    return currentSnapshot !== initialSnapshotRef.current;
  };

  // Save changes to Supabase
  const handleSave = async (): Promise<boolean> => {
    if (!shopId) return false;
    setIsSaving(true);
    setSaveMessage("");

    try {
      const updatedServices = servicesList.map((item) => {
        if (item.id === "core_bw") return { ...item, price: priceBw, enabled: true };
        if (item.id === "core_color") return { ...item, price: priceColor, enabled: colorEnabled };
        return item;
      });

      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("update_shop_settings", {
        p_shop_id: shopId,
        p_price_bw: priceBw,
        p_price_color: priceColor,
        p_services: updatedServices,
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || "Failed to update shop settings");
      }

      await refreshShop();
      initialSnapshotRef.current = JSON.stringify({
        priceBw,
        priceColor,
        colorEnabled,
        servicesList,
      });
      setSaveMessage("Rates and services updated successfully! Web app is now in sync.");
      setTimeout(() => setSaveMessage(""), 4000);
      return true;
    } catch (err) {
      alert("Error saving rates: " + (err instanceof Error ? err.message : String(err)));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Register dirty handler with parent
  useEffect(() => {
    if (!onRegisterDirtyHandler) return;
    onRegisterDirtyHandler({
      isDirty,
      save: handleSave,
      discard: handleDiscard,
      pageName: "Services & Rates",
    });
    return () => {
      onRegisterDirtyHandler(null);
    };
  }, [priceBw, priceColor, colorEnabled, servicesList, shopId]);

  // Unit label helper
  const getUnitLabel = (unit: ServiceUnit) => {
    switch (unit) {
      case "per_sheet":
        return "Per Sheet";
      case "per_document":
        return "Per Job";
      case "flat":
        return "Flat Fee";
      case "per_copy":
      default:
        return "Per Copy";
    }
  };

  const activeFinishingCount = servicesList.filter((s) => !s.isCore && s.enabled).length;

  return (
    <div className="content fade-in">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title">
            <span>Services & Rates</span>
            <span className="tech-tag active">Live Pricing</span>
          </h1>
          <p className="page-subtitle">
            Configure default Black & White and Color rates, manage finishing add-ons, and create custom services. Prices automatically reflect on customer counter QR scans.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="login-btn"
          style={{ width: "auto", minWidth: 160 }}
        >
          {isSaving ? (
            <>
              <IconRefresh size={14} className="animate-spin-slow" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <IconCheck size={14} />
              <span>Save Rates & Services</span>
            </>
          )}
        </button>
      </div>

      {saveMessage && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "12px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: "var(--accent-emerald)",
            fontWeight: 600,
          }}
        >
          <IconCheck size={16} />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            <span>B&W PRINT RATE</span>
            <span className="tech-tag">Standard</span>
          </div>
          <div className="stat-value">₹{priceBw.toFixed(2)}</div>
          <div className="stat-footnote">Per printed page (A4)</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>COLOR PRINT RATE</span>
            <span className={`tech-tag ${colorEnabled ? "active" : ""}`}>
              {colorEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="stat-value" style={{ color: colorEnabled ? "var(--text-primary)" : "var(--text-muted)" }}>
            ₹{priceColor.toFixed(2)}
          </div>
          <div className="stat-footnote">
            {colorEnabled ? "Active for customer selection" : "Turned off (Customer sees B&W only)"}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>ACTIVE ADD-ONS</span>
            <span className="tech-tag">{activeFinishingCount} Live</span>
          </div>
          <div className="stat-value green">{activeFinishingCount}</div>
          <div className="stat-footnote">Finishing & custom services enabled</div>
        </div>

      </div>

      {/* SECTION 1: Default Core Print Services */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">
            <span>Core Print Services</span>
            <span className="tech-tag">Default Services</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            A4 Standard Page Rates
          </span>
        </div>

        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Black & White */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              background: "rgba(255, 255, 255, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-sm)",
                  background: "#16181D",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                }}
              >
                B&W
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  Black & White Printing
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Default monochrome printing service • Cannot be disabled
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>₹</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={priceBw}
                  onChange={(e) => handlePriceChange("core_bw", Number(e.target.value))}
                  style={{
                    width: 90,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "#ffffff",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono, monospace)",
                    textAlign: "right",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ page</span>
              </div>
              <span className="status-badge active" style={{ marginLeft: 6 }}>● Active</span>
            </div>
          </div>

          {/* Color Printing */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              background: colorEnabled ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.02)",
              border: `1px solid ${colorEnabled ? "var(--border-subtle)" : "rgba(0, 0, 0, 0.08)"}`,
              borderRadius: "var(--radius-lg)",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-md)",
                  background: colorEnabled
                    ? "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)"
                    : "#a1a1aa",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: colorEnabled ? "0 4px 12px rgba(168, 85, 247, 0.25)" : "none",
                }}
              >
                CLR
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    Color Printing
                  </span>
                  {!colorEnabled && (
                    <span
                      style={{
                        fontSize: 11,
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "var(--accent-rose)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        fontWeight: 600,
                      }}
                    >
                      Turned Off (Out of Ink)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Full-color document printing • Toggle off if color printer is offline
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>₹</span>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={priceColor}
                  onChange={(e) => handlePriceChange("core_color", Number(e.target.value))}
                  disabled={!colorEnabled}
                  style={{
                    width: 90,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: colorEnabled ? "#ffffff" : "#f4f4f5",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono, monospace)",
                    textAlign: "right",
                    outline: "none",
                    color: colorEnabled ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ page</span>
              </div>

              {/* Toggle switch */}
              <div
                className="toggle-switch-wrapper"
                onClick={() => handleToggle("core_color")}
                title={colorEnabled ? "Click to disable color prints" : "Click to enable color prints"}
              >
                <div className={`toggle-switch ${colorEnabled ? "checked" : ""}`}>
                  <div className="toggle-thumb" />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {colorEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Finishing & Additional Services */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">
            <span>Finishing & Additional Services</span>
            <span className="tech-tag">Customer Add-ons</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCustom((p) => !p)}
            className="btn-ghost"
            style={{ fontSize: 12 }}
          >
            {showAddCustom ? "− Close Form" : "+ Add Custom Service"}
          </button>
        </div>

        <div className="card-body">
          {/* Add custom service inline form */}
          {showAddCustom && (
            <form
              onSubmit={handleAddCustom}
              style={{
                background: "rgba(99, 102, 241, 0.05)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                borderRadius: "var(--radius-lg)",
                padding: "18px 20px",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                Create New Shop Offering
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    Service Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Glossy Sticker, A3 Print, Hardcover Thesis"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="login-input"
                    style={{ padding: "8px 12px", fontSize: 13 }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(Number(e.target.value))}
                    className="login-input"
                    style={{ padding: "8px 12px", fontSize: 13, fontFamily: "var(--font-mono, monospace)" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    Billing Unit
                  </label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as ServiceUnit)}
                    className="login-input"
                    style={{ padding: "8px 12px", fontSize: 13 }}
                  >
                    <option value="per_copy">Per Copy / Document</option>
                    <option value="per_sheet">Per Printed Sheet</option>
                    <option value="per_document">Per Entire Job</option>
                    <option value="flat">Flat Rate</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="login-btn"
                  style={{ width: "auto", padding: "8px 18px" }}
                >
                  Add Service
                </button>
              </div>
            </form>
          )}

          {/* List of finishing services */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {servicesList
              .filter((s) => !s.isCore)
              .map((service) => (
                <div
                  key={service.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    background: service.enabled ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.02)",
                    border: `1px solid ${service.enabled ? "var(--border-subtle)" : "rgba(0, 0, 0, 0.06)"}`,
                    borderRadius: "var(--radius-lg)",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Toggle switch */}
                    <div
                      className="toggle-switch-wrapper"
                      onClick={() => handleToggle(service.id)}
                      title={service.enabled ? "Disable this service" : "Enable this service"}
                    >
                      <div className={`toggle-switch ${service.enabled ? "checked" : ""}`}>
                        <div className="toggle-thumb" />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: service.enabled ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {service.name}
                        </span>
                        <span className="chip-hardware" style={{ fontSize: 10, padding: "2px 8px" }}>
                          {getUnitLabel(service.unit)}
                        </span>
                        {service.id.startsWith("custom_") && (
                          <span
                            style={{
                              fontSize: 10,
                              background: "rgba(99, 102, 241, 0.1)",
                              color: "var(--text-secondary)",
                              padding: "2px 6px",
                              borderRadius: "var(--radius-full)",
                              fontWeight: 600,
                            }}
                          >
                            Custom
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>₹</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={service.price}
                        onChange={(e) => handlePriceChange(service.id, Number(e.target.value))}
                        disabled={!service.enabled}
                        style={{
                          width: 80,
                          padding: "6px 10px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-subtle)",
                          background: service.enabled ? "#ffffff" : "#f4f4f5",
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "var(--font-mono, monospace)",
                          textAlign: "right",
                          outline: "none",
                          color: service.enabled ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      />
                    </div>

                    {service.id.startsWith("custom_") && (
                      <button
                        type="button"
                        onClick={() => handleDelete(service.id)}
                        className="btn-ghost"
                        style={{
                          padding: "6px 10px",
                          color: "var(--accent-rose)",
                          borderColor: "rgba(239, 68, 68, 0.2)",
                        }}
                        title="Delete custom service"
                      >
                        <IconTrash size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
});
