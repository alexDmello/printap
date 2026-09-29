import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getSupabase,
  DEFAULT_SHOP_SERVICES,
  type ShopServiceItem,
  type ServiceUnit,
} from "@printap/shared";
import {
  IconTag,
  IconCheck,
  IconPlus,
  IconTrash,
} from "./Icons";

export const ServicesControl: React.FC = () => {
  const { shop, shopId, refreshShop } = useAuth();

  // Pricing & Services State
  const [priceBw, setPriceBw] = useState<number>(() =>
    shop?.price_bw !== undefined && shop?.price_bw !== null ? Number(shop.price_bw) : 2
  );
  const [priceColor, setPriceColor] = useState<number>(() =>
    shop?.price_color !== undefined && shop?.price_color !== null ? Number(shop.price_color) : 10
  );
  const [colorEnabled, setColorEnabled] = useState<boolean>(true);
  const [servicesList, setServicesList] = useState<ShopServiceItem[]>(DEFAULT_SHOP_SERVICES);

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // New Custom Service Form
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState<number>(25);
  const [newServiceUnit, setNewServiceUnit] = useState<ServiceUnit>("per_copy");
  const [newServiceCategory, setNewServiceCategory] = useState<"print" | "finishing" | "addon">("finishing");

  // Sync pricing state when shop loads or updates
  useEffect(() => {
    if (shop) {
      if (shop.price_bw !== undefined && shop.price_bw !== null) {
        setPriceBw(Number(shop.price_bw));
      }
      if (shop.price_color !== undefined && shop.price_color !== null) {
        setPriceColor(Number(shop.price_color));
      }
      if (shop.services && Array.isArray(shop.services) && shop.services.length > 0) {
        setServicesList(shop.services);
        const colorItem = shop.services.find((s) => s.id === "core_color");
        if (colorItem) setColorEnabled(colorItem.enabled);
      } else {
        setServicesList(
          DEFAULT_SHOP_SERVICES.map((s) => {
            if (s.id === "core_bw" && shop.price_bw !== undefined) return { ...s, price: Number(shop.price_bw) };
            if (s.id === "core_color" && shop.price_color !== undefined) return { ...s, price: Number(shop.price_color) };
            return s;
          })
        );
      }
    }
  }, [shop]);

  const handleToggleService = (id: string) => {
    if (id === "core_color") {
      setColorEnabled((prev) => !prev);
    }
    setServicesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    if (id === "core_bw") setPriceBw(newPrice);
    if (id === "core_color") setPriceColor(newPrice);
    setServicesList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: newPrice } : s))
    );
  };

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    const newService: ShopServiceItem = {
      id: "custom_" + Date.now(),
      name: newServiceName.trim(),
      price: Number(newServicePrice) || 0,
      unit: newServiceUnit,
      enabled: true,
      category: newServiceCategory,
    };
    setServicesList((prev) => [...prev, newService]);
    setNewServiceName("");
    setNewServicePrice(25);
    setShowAddCustom(false);
  };

  const handleDeleteService = (id: string) => {
    setServicesList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    if (!shopId) return;
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const updatedServices = servicesList.map((item) => {
        if (item.id === "core_bw") return { ...item, price: priceBw, enabled: true };
        if (item.id === "core_color") return { ...item, price: priceColor, enabled: colorEnabled };
        return item;
      });

      const supabase = getSupabase();
      const { error } = await supabase
        .from("shops")
        .update({
          price_bw: priceBw,
          price_color: priceColor,
          services: updatedServices,
        })
        .eq("id", shopId);

      if (error) throw error;

      await refreshShop();
      setServicesList(updatedServices);
      setStatusMessage({
        text: "Rates and services updated successfully!",
        type: "success",
      });

      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error("[ServicesControl] Save failed:", err);
      setStatusMessage({
        text: `Error saving rates: ${err instanceof Error ? err.message : String(err)}`,
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const nonCoreServices = servicesList.filter((s) => !s.isCore);

  return (
    <div className="content fade-in">
      {/* Page Header */}
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
            <span>Services & Rates</span>
            <span className="tech-tag active">Dynamic Pricing</span>
          </h1>
          <p className="page-subtitle">
            Set your shop's base rates for Black & White and Color printing, toggle color printer availability, and manage additional services.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {statusMessage && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color:
                  statusMessage.type === "success"
                    ? "var(--accent-emerald)"
                    : "var(--accent-rose)",
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background:
                  statusMessage.type === "success"
                    ? "var(--accent-emerald-light)"
                    : "var(--accent-rose-light)",
              }}
            >
              {statusMessage.text}
            </span>
          )}

          <button
            type="button"
            className="login-btn"
            style={{ width: "auto", margin: 0, padding: "8px 18px" }}
            onClick={handleSave}
            disabled={isSaving}
          >
            <IconCheck size={14} />
            <span>{isSaving ? "Saving Rates..." : "Save All Rates"}</span>
          </button>
        </div>
      </div>

      {/* ─── 1. Core Printing Rates Card ─── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">
            <IconTag size={16} />
            <span>Core Print Services (A4 Standard)</span>
          </div>
          <span className="status-badge active">● Required Defaults</span>
        </div>

        <div className="card-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            {/* Black & White */}
            <div
              style={{
                padding: 18,
                borderRadius: "var(--radius-lg)",
                background: "rgba(255, 255, 255, 0.7)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                    Black & White Print
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    Monochrome laser per-page rate
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(0, 0, 0, 0.06)",
                    color: "var(--text-primary)",
                  }}
                >
                  Always Active
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Rate per Printed Page (₹)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      fontSize: 14,
                    }}
                  >
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={priceBw}
                    onChange={(e) => handleUpdatePrice("core_bw", Number(e.target.value))}
                    className="login-input"
                    style={{
                      paddingLeft: 28,
                      fontWeight: 700,
                      fontSize: 15,
                      marginBottom: 0,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Full Color */}
            <div
              style={{
                padding: 18,
                borderRadius: "var(--radius-lg)",
                background: colorEnabled
                  ? "rgba(255, 255, 255, 0.7)"
                  : "rgba(244, 244, 245, 0.5)",
                border: colorEnabled
                  ? "1px solid var(--border-subtle)"
                  : "1px dashed var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                opacity: colorEnabled ? 1 : 0.7,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
                    Full Color Print
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    Full-color inkjet / laser per-page rate
                  </div>
                </div>

                {/* Color Kill-Switch Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleService("core_color")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "var(--radius-full)",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: colorEnabled
                      ? "var(--accent-emerald-light)"
                      : "rgba(0, 0, 0, 0.08)",
                    color: colorEnabled
                      ? "var(--accent-emerald)"
                      : "var(--text-secondary)",
                    transition: "all var(--transition)",
                  }}
                  title={colorEnabled ? "Click to disable color prints (out of ink)" : "Click to enable color prints"}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: colorEnabled ? "var(--accent-emerald)" : "#a1a1aa",
                    }}
                  />
                  <span>{colorEnabled ? "Color Enabled" : "Color Disabled"}</span>
                </button>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Rate per Printed Page (₹)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      fontSize: 14,
                    }}
                  >
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={priceColor}
                    disabled={!colorEnabled}
                    onChange={(e) => handleUpdatePrice("core_color", Number(e.target.value))}
                    className="login-input"
                    style={{
                      paddingLeft: 28,
                      fontWeight: 700,
                      fontSize: 15,
                      marginBottom: 0,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Additional & Finishing Services Card ─── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>Additional Services & Finishing Add-ons</span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                background: "rgba(0, 0, 0, 0.05)",
                color: "var(--text-secondary)",
              }}
            >
              {nonCoreServices.filter((s) => s.enabled).length} Active
            </span>
          </div>

          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => setShowAddCustom((p) => !p)}
          >
            <IconPlus size={13} />
            <span>{showAddCustom ? "Close Form" : "Add Custom Service"}</span>
          </button>
        </div>

        <div className="card-body">
          {/* Inline Add Form */}
          {showAddCustom && (
            <form
              onSubmit={handleAddCustomService}
              style={{
                padding: 16,
                borderRadius: "var(--radius-lg)",
                background: "rgba(255, 255, 255, 0.9)",
                border: "1px solid var(--border-active)",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 12,
                  color: "var(--text-primary)",
                }}
              >
                Create New Service / Add-on
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: 4,
                    }}
                  >
                    Service Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Glossy Sticker Sheet, A3 Large Format, Thesis Hardbound"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    className="login-input"
                    style={{ marginBottom: 0, fontSize: 13 }}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: 4,
                    }}
                  >
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(Number(e.target.value))}
                    className="login-input"
                    style={{ marginBottom: 0, fontSize: 13, fontWeight: 700 }}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: 4,
                    }}
                  >
                    Billing Unit
                  </label>
                  <select
                    value={newServiceUnit}
                    onChange={(e) => setNewServiceUnit(e.target.value as ServiceUnit)}
                    className="login-input"
                    style={{ marginBottom: 0, fontSize: 12, height: 42 }}
                  >
                    <option value="per_copy">Per Copy / Document</option>
                    <option value="per_sheet">Per Printed Sheet</option>
                    <option value="per_document">Per Entire Job</option>
                    <option value="flat">Flat Rate</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowAddCustom(false)}
                  style={{ fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="login-btn"
                  style={{ width: "auto", margin: 0, padding: "6px 16px", fontSize: 12 }}
                >
                  <IconPlus size={12} />
                  <span>Add to Menu</span>
                </button>
              </div>
            </form>
          )}

          {/* Services List Table / Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nonCoreServices.map((service) => {
              const unitLabel =
                service.unit === "per_sheet"
                  ? "per sheet"
                  : service.unit === "per_copy"
                  ? "per copy"
                  : service.unit === "per_document"
                  ? "per job"
                  : "flat fee";

              return (
                <div
                  key={service.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 18px",
                    borderRadius: "var(--radius-md)",
                    background: service.enabled
                      ? "rgba(255, 255, 255, 0.75)"
                      : "rgba(244, 244, 245, 0.5)",
                    border: "1px solid var(--border-subtle)",
                    transition: "all var(--transition)",
                  }}
                >
                  {/* Left: Info */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleService(service.id)}
                      style={{
                        width: 38,
                        height: 22,
                        borderRadius: 12,
                        border: "none",
                        cursor: "pointer",
                        background: service.enabled
                          ? "var(--accent-emerald)"
                          : "rgba(0, 0, 0, 0.15)",
                        position: "relative",
                        transition: "all var(--transition)",
                        flexShrink: 0,
                      }}
                      title={service.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#ffffff",
                          position: "absolute",
                          top: 3,
                          left: service.enabled ? 19 : 3,
                          transition: "all var(--transition)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </button>

                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: service.enabled ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        {service.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        Billing:{" "}
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {unitLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Delete */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={service.price}
                        onChange={(e) =>
                          handleUpdatePrice(service.id, Number(e.target.value))
                        }
                        className="login-input"
                        style={{
                          width: 80,
                          padding: "6px 8px",
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 0,
                          textAlign: "right",
                        }}
                      />
                    </div>

                    {service.id.startsWith("custom_") && (
                      <button
                        type="button"
                        onClick={() => handleDeleteService(service.id)}
                        className="btn-ghost"
                        style={{
                          padding: "6px 8px",
                          color: "var(--accent-rose)",
                        }}
                        title="Delete custom service"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
