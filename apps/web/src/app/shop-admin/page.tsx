"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getSupabase,
  getCustomerPrintUrl,
  getShopCustomerUrl,
  ROOT_DOMAIN,
  DEFAULT_SHOP_SERVICES,
  type ShopInfo,
  type ShopServiceItem,
  type ServiceUnit,
} from "@printap/shared";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

type Tab = "overview" | "services" | "qr" | "printers" | "analytics" | "profile";

interface PrinterAssignment {
  id: string;
  printer_name: string;
  role: "bw" | "color" | "both";
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface PrintEvent {
  id: string;
  session_id: string;
  fee_amount: number;
  created_at: string;
}

export default function ShopAdminPage() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // QR / Standee State
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const qrSvgRef = useRef<HTMLDivElement>(null);

  // Data
  const [printers, setPrinters] = useState<PrinterAssignment[]>([]);
  const [printEvents, setPrintEvents] = useState<PrintEvent[]>([]);
  const [newPrinterName, setNewPrinterName] = useState("");
  const [newPrinterRole, setNewPrinterRole] = useState<"bw" | "color" | "both">("bw");

  const customerUrl = getShopCustomerUrl(shop);

  // Pricing & Services State
  const [priceBw, setPriceBw] = useState<number>(2);
  const [priceColor, setPriceColor] = useState<number>(10);
  const [colorEnabled, setColorEnabled] = useState<boolean>(true);
  const [servicesList, setServicesList] = useState<ShopServiceItem[]>(DEFAULT_SHOP_SERVICES);
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [saveServicesMsg, setSaveServicesMsg] = useState("");

  // New Custom Service Form State
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState<number>(25);
  const [newServiceUnit, setNewServiceUnit] = useState<ServiceUnit>("per_copy");
  const [newServiceCategory, setNewServiceCategory] = useState<"print" | "finishing" | "addon">("finishing");

  // Sync pricing state when shop loads
  useEffect(() => {
    if (shop) {
      if (shop.price_bw !== undefined && shop.price_bw !== null) setPriceBw(Number(shop.price_bw));
      if (shop.price_color !== undefined && shop.price_color !== null) setPriceColor(Number(shop.price_color));
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

  const handleUpdateServicePrice = (id: string, newPrice: number) => {
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

  const handleSaveServices = async () => {
    if (!shopId) return;
    setIsSavingServices(true);
    setSaveServicesMsg("");
    try {
      const updatedServices = servicesList.map((item) => {
        if (item.id === "core_bw") return { ...item, price: priceBw, enabled: true };
        if (item.id === "core_color") return { ...item, price: priceColor, enabled: colorEnabled };
        return item;
      });

      const res = await fetch("/api/shop/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          priceBw,
          priceColor,
          services: updatedServices,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to update pricing");

      setServicesList(updatedServices);
      setShop((prev) =>
        prev
          ? {
              ...prev,
              price_bw: priceBw,
              price_color: priceColor,
              services: updatedServices,
            }
          : prev
      );
      setSaveServicesMsg("Pricing and services updated successfully!");
      setTimeout(() => setSaveServicesMsg(""), 3500);
    } catch (err) {
      alert("Error saving: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingServices(false);
    }
  };

  // 1. Restore login from localStorage
  const loadShop = useCallback(async (id: string) => {
    setLoading(true);
    setLoginError("");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setLoginError("Shop not found. Please verify your Shop ID.");
        localStorage.removeItem("printap_shop_id");
        setShop(null);
        setShopId(null);
      } else {
        setShop(data as ShopInfo);
        setShopId(data.id);
        localStorage.setItem("printap_shop_id", data.id);
      }
    } catch (err) {
      setLoginError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("printap_shop_id");
    if (saved) {
      loadShop(saved.trim());
    } else {
      setLoading(false);
    }
  }, [loadShop]);

  // 2. Fetch Shop Printers and Events
  const loadShopData = useCallback(async () => {
    if (!shopId) return;
    const supabase = getSupabase();

    // Printers
    const { data: printersData } = await supabase
      .from("printer_assignments")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    if (printersData) setPrinters(printersData as PrinterAssignment[]);

    // Print Events
    const { data: eventsData } = await supabase
      .from("print_events")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (eventsData) setPrintEvents(eventsData as PrintEvent[]);
  }, [shopId]);

  useEffect(() => {
    if (shopId) {
      loadShopData();
    }
  }, [shopId, loadShopData]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = loginInput.trim();
    if (!trimmed) {
      setLoginError("Please enter your Shop ID");
      return;
    }
    loadShop(trimmed);
  };

  const handleLogout = () => {
    localStorage.removeItem("printap_shop_id");
    setShop(null);
    setShopId(null);
  };

  // Copy Link
  const handleCopy = () => {
    if (!customerUrl) return;
    navigator.clipboard.writeText(customerUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Export Standee
  const downloadStandeePoster = () => {
    setIsExporting(true);
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) {
      setIsExporting(false);
      return;
    }

    const W = 1200;
    const H = 1600;
    const poster = document.createElement("canvas");
    poster.width = W;
    poster.height = H;
    const ctx = poster.getContext("2d");
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, 220);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🖨️ PRINTAP SELF-SERVICE COUNTER", W / 2, 95);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("SCAN WITH PHONE • CHOOSE PDF • COLLECT PRINT", W / 2, 145);

    ctx.fillStyle = "#09090b";
    ctx.font = "bold 54px Inter, sans-serif";
    ctx.fillText(shop?.name || "Printap Counter", W / 2, 330);

    ctx.fillStyle = "#52525b";
    ctx.font = "500 24px Inter, sans-serif";
    ctx.fillText(customerUrl, W / 2, 385);

    const qrBoxSize = 620;
    const qrBoxX = (W - qrBoxSize) / 2;
    const qrBoxY = 440;

    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
    ctx.fill();
    ctx.stroke();

    const qrDrawSize = 520;
    const qrDrawOffset = (qrBoxSize - qrDrawSize) / 2;
    ctx.drawImage(canvas, qrBoxX + qrDrawOffset, qrBoxY + qrDrawOffset, qrDrawSize, qrDrawSize);

    const stepsY = 1110;
    ctx.fillStyle = "#09090b";
    ctx.font = "bold 30px Inter, sans-serif";
    ctx.fillText("HOW IT WORKS", W / 2, stepsY);

    const steps = [
      { num: "1", title: "Scan QR", desc: "Open phone camera" },
      { num: "2", title: "Select PDF", desc: "Choose B&W or Color" },
      { num: "3", title: "Collect Print", desc: "Instant spool & shred" },
    ];

    const colWidth = W / 3;
    steps.forEach((step, idx) => {
      const cx = colWidth * idx + colWidth / 2;
      const cy = stepsY + 60;
      ctx.fillStyle = "#09090b";
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px Inter, sans-serif";
      ctx.fillText(step.num, cx, cy + 8);

      ctx.fillStyle = "#09090b";
      ctx.font = "bold 24px Inter, sans-serif";
      ctx.fillText(step.title, cx, cy + 65);

      ctx.fillStyle = "#71717a";
      ctx.font = "400 20px Inter, sans-serif";
      ctx.fillText(step.desc, cx, cy + 98);
    });

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 1370);
    ctx.lineTo(W - 100, 1370);
    ctx.stroke();

    ctx.fillStyle = "#059669";
    ctx.font = "bold 26px monospace";
    ctx.fillText(`Direct UPI: ${shop?.upi_vpa || "shop@upi"}`, W / 2, 1430);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "400 20px Inter, sans-serif";
    ctx.fillText("Zero Cloud Storage Liability • Peer-to-Peer Encrypted WebRTC", W / 2, 1480);

    const link = document.createElement("a");
    const safeShopName = (shop?.name || "Shop").replace(/[^a-z0-9]/gi, "_");
    link.download = `Printap_Counter_Standee_${safeShopName}.png`;
    link.href = poster.toDataURL("image/png");
    link.click();
    setIsExporting(false);
  };

  // Export Raw PNG
  const downloadRawQrPng = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1024;
    exportCanvas.height = 1024;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.drawImage(canvas, 64, 64, 896, 896);

    const link = document.createElement("a");
    const safeShopName = (shop?.name || "Shop").replace(/[^a-z0-9]/gi, "_");
    link.download = `Printap_QR_${safeShopName}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  // Export SVG
  const downloadRawQrSvg = () => {
    const svgEl = qrSvgRef.current?.querySelector("svg");
    if (!svgEl) return;

    const svgXml = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const safeShopName = (shop?.name || "Shop").replace(/[^a-z0-9]/gi, "_");
    link.download = `Printap_QR_${safeShopName}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Add Printer
  const handleAddPrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || !newPrinterName.trim()) return;

    const supabase = getSupabase();
    await supabase.from("printer_assignments").insert({
      shop_id: shopId,
      printer_name: newPrinterName.trim(),
      role: newPrinterRole,
      is_default: printers.length === 0,
      is_active: true,
    });

    setNewPrinterName("");
    loadShopData();
  };

  const handleTogglePrinter = async (printer: PrinterAssignment) => {
    const supabase = getSupabase();
    await supabase
      .from("printer_assignments")
      .update({ is_active: !printer.is_active })
      .eq("id", printer.id);
    loadShopData();
  };

  const handleDeletePrinter = async (id: string) => {
    const supabase = getSupabase();
    await supabase.from("printer_assignments").delete().eq("id", id);
    loadShopData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-8 text-center glow-sm">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[--color-muted]">Loading Shop Portal...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Glassmorphic Sign In Card
  if (!shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 mx-auto mb-4">
              🏪
            </div>
            <h1 className="text-3xl font-bold gradient-text tracking-tight mb-2">
              Shop Admin Portal
            </h1>
            <p className="text-xs text-[--color-muted]">
              shop.{ROOT_DOMAIN} • Counter Management & Signage
            </p>
          </div>

          <form onSubmit={handleLogin} className="glass rounded-2xl p-7 glow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[--color-foreground]/80 mb-2">
                Terminal Shop ID (UUID)
              </label>
              <input
                type="text"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-sm text-[--color-foreground] placeholder-[--color-muted] focus:outline-none focus:border-[--color-accent] transition font-mono"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 rounded-xl font-semibold text-white text-sm"
            >
              Sign In to Counter Terminal →
            </button>
          </form>

          <p className="text-center text-xs text-[--color-muted]/60 mt-6">
            Need a shop account? Contact platform operations at admin.{ROOT_DOMAIN}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-6 max-w-6xl mx-auto w-full">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between py-4 border-b border-[--color-border]/60 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-md">
            🖨️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[--color-foreground]">{shop.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active Terminal
              </span>
            </div>
            <p className="text-xs text-[--color-muted]">
              Customer URL:{" "}
              <a
                href={customerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[--color-accent-light] hover:underline font-mono"
              >
                {customerUrl}
              </a>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl text-xs font-medium glass hover:bg-[--color-surface-light] transition flex items-center gap-1.5"
          >
            {copiedLink ? "✓ Link Copied!" : "📋 Copy Print Link"}
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-[--color-muted] hover:text-[--color-foreground] glass hover:bg-[--color-surface-light] transition"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Segmented Navigation Tabs */}
      <nav className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: "overview", label: "Overview & Activity" },
          { key: "services", label: "🏷️ Services & Rates" },
          { key: "qr", label: "Counter QR & Standee" },
          { key: "printers", label: "Printer Assignments" },
          { key: "analytics", label: "Analytics & Ledger" },
          { key: "profile", label: "Shop Profile" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as Tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === t.key
                ? "bg-[--color-accent] text-white shadow-md shadow-indigo-500/20"
                : "glass text-[--color-muted] hover:text-[--color-foreground]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5 glow-sm">
              <div className="text-xs text-[--color-muted] mb-1">Customer Print Domain</div>
              <div className="text-lg font-bold font-mono text-indigo-400 truncate">
                {shop.slug || shop.id}.{ROOT_DOMAIN}
              </div>
              <p className="text-[11px] text-[--color-muted] mt-2">
                Customers scan QR and connect directly here
              </p>
            </div>

            <div className="glass rounded-2xl p-5 glow-sm">
              <div className="text-xs text-[--color-muted] mb-1">Total Lifetime Prints</div>
              <div className="text-2xl font-bold text-[--color-foreground]">
                {printEvents.length}
              </div>
              <p className="text-[11px] text-[--color-muted] mt-2">
                Direct P2P print completions
              </p>
            </div>

            <div className="glass rounded-2xl p-5 glow-sm">
              <div className="text-xs text-[--color-muted] mb-1">Configured Printers</div>
              <div className="text-2xl font-bold text-emerald-400">
                {printers.filter((p) => p.is_active).length} Active
              </div>
              <p className="text-[11px] text-[--color-muted] mt-2">
                {printers.length} total assigned in system
              </p>
            </div>
          </div>

          {/* Quick Counter QR Card */}
          <div className="glass rounded-2xl p-6 glow-sm flex items-center justify-between flex-wrap gap-6">
            <div>
              <h2 className="text-base font-bold mb-1">Counter Acrylic Stand Ready</h2>
              <p className="text-xs text-[--color-muted] max-w-md">
                Display this QR code at your shop counter. Customers scan with their phone camera to beam documents without sending WhatsApp messages or emails.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setActiveTab("qr")}
                  className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold text-white"
                >
                  Generate Counter Standee →
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-lg">
              <QRCodeCanvas value={customerUrl} size={130} level="H" />
            </div>
          </div>

          {/* Recent Events Table */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4 text-[--color-foreground]">
              Recent Print Sessions
            </h2>
            {printEvents.length === 0 ? (
              <p className="text-xs text-[--color-muted] py-6 text-center">
                No print jobs recorded yet. When a customer beams a file, sessions will show here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[--color-border] text-[--color-muted]">
                      <th className="pb-3 font-medium">Session ID</th>
                      <th className="pb-3 font-medium">Timestamp</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--color-border]/50">
                    {printEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-3 font-mono text-[--color-foreground]/90">
                          #{ev.session_id.slice(0, 8)}
                        </td>
                        <td className="py-3 text-[--color-muted]">
                          {new Date(ev.created_at).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                            ✓ Spooled & Shredded
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SERVICES & RATES */}
      {activeTab === "services" && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Top Header & Save Action */}
          <div className="flex items-center justify-between flex-wrap gap-4 glass rounded-2xl p-6 glow-sm">
            <div>
              <h2 className="text-base font-bold text-[--color-foreground]">
                Services & Custom Pricing Management
              </h2>
              <p className="text-xs text-[--color-muted] mt-1 max-w-lg">
                Configure your shop's per-page printing rates, toggle color printing availability, and manage additional finishing services offered to customers.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saveServicesMsg && (
                <span className="text-xs font-semibold text-emerald-400 animate-fade-in-up">
                  ✓ {saveServicesMsg}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveServices}
                disabled={isSavingServices}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                {isSavingServices ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>💾 Save All Pricing & Services</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 1: Default Core Printing Services */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[--color-muted]">
                Default Core Services (Standard Document Printing)
              </h3>
              <span className="text-[11px] text-emerald-400 font-medium">
                ● Always accessible to customer phone scans
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Core 1: Black & White */}
              <div className="glass rounded-2xl p-5 glow-sm border border-[--color-border]/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm shadow">
                      📄
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[--color-foreground]">
                        Black & White Printing
                      </div>
                      <div className="text-[10px] text-[--color-muted]">
                        Monochrome standard A4/Legal
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active • Core
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-[--color-border]/50 flex items-center justify-between">
                  <label className="text-xs text-[--color-muted]">
                    Price per Page (₹)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[--color-foreground]">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={priceBw}
                      onChange={(e) => handleUpdateServicePrice("core_bw", Math.max(0.5, Number(e.target.value)))}
                      className="w-24 px-3 py-1.5 rounded-lg bg-[--color-surface-light] border border-[--color-border] text-sm text-[--color-foreground] font-bold text-center focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-[--color-muted]">/ page</span>
                  </div>
                </div>
              </div>

              {/* Core 2: Color Printing */}
              <div className="glass rounded-2xl p-5 glow-sm border border-[--color-border]/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-sm shadow">
                      🎨
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[--color-foreground]">
                        Color Printing
                      </div>
                      <div className="text-[10px] text-[--color-muted]">
                        Full color A4/Photo reproduction
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleService("core_color")}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1.5 ${
                      colorEnabled
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${colorEnabled ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    {colorEnabled ? "Enabled" : "Disabled (Out of Ink/Offline)"}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-[--color-border]/50 flex items-center justify-between">
                  <label className="text-xs text-[--color-muted]">
                    Price per Page (₹)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[--color-foreground]">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={priceColor}
                      onChange={(e) => handleUpdateServicePrice("core_color", Math.max(1, Number(e.target.value)))}
                      className="w-24 px-3 py-1.5 rounded-lg bg-[--color-surface-light] border border-[--color-border] text-sm text-[--color-foreground] font-bold text-center focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-[--color-muted]">/ page</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Additional & Finishing Services */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[--color-muted]">
                Additional & Finishing Services (Customer Add-ons)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustom((p: boolean) => !p)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
              >
                {showAddCustom ? "− Hide Add Form" : "+ Add New Custom Service"}
              </button>
            </div>

            {/* Optional Inline Add Form */}
            {showAddCustom && (
              <form
                onSubmit={handleAddCustomService}
                className="glass rounded-2xl p-5 mb-4 glow-sm border border-indigo-500/30 space-y-3 animate-fade-in-up"
              >
                <div className="text-xs font-bold text-[--color-foreground]">
                  Create New Shop Service
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-[--color-muted] mb-1">
                      Service Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Glossy Sticker Sheet, A3 Large Format, Thesis Hardbound"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground] focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[--color-muted] mb-1">
                      Price (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground] font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[--color-muted] mb-1">
                      Billing Unit
                    </label>
                    <select
                      value={newServiceUnit}
                      onChange={(e) => setNewServiceUnit(e.target.value as ServiceUnit)}
                      className="w-full px-3 py-2 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground] focus:outline-none focus:border-indigo-500"
                    >
                      <option value="per_copy">Per Copy / Document</option>
                      <option value="per_sheet">Per Printed Sheet</option>
                      <option value="per_document">Per Entire Job</option>
                      <option value="flat">Flat Rate</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCustom(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-[--color-muted] hover:text-[--color-foreground]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                  >
                    Add Service to Menu
                  </button>
                </div>
              </form>
            )}

            {/* List of services */}
            <div className="glass rounded-2xl overflow-hidden glow-sm border border-[--color-border]/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[--color-border] text-[--color-muted] bg-[--color-surface-light]/40">
                    <th className="py-3 px-4 font-semibold">Service Name</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Price (₹)</th>
                    <th className="py-3 px-4 font-semibold">Billing Unit</th>
                    <th className="py-3 px-4 font-semibold">Status / Toggle</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--color-border]/40">
                  {servicesList
                    .filter((s) => !s.isCore)
                    .map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-[--color-surface-light]/20 transition ${
                          !item.enabled ? "opacity-60" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-medium text-[--color-foreground]">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[--color-surface-light] text-[--color-muted] capitalize">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[--color-muted]">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) =>
                                handleUpdateServicePrice(item.id, Number(e.target.value))
                              }
                              className="w-20 px-2 py-1 rounded bg-[--color-surface-light] border border-[--color-border] text-xs font-semibold font-mono text-[--color-foreground] focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[--color-muted] capitalize">
                          {item.unit.replace("_", " ")}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleService(item.id)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1.5 ${
                              item.enabled
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.enabled ? "bg-emerald-400" : "bg-zinc-500"
                              }`}
                            />
                            {item.enabled ? "Enabled" : "Disabled"}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {item.id.startsWith("custom_") ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteService(item.id)}
                              className="text-red-400 hover:text-red-300 text-[11px] font-medium"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-[10px] text-[--color-muted]">Preset</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QR & STANDEE */}
      {activeTab === "qr" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
          {/* Standee Preview */}
          <div className="glass rounded-3xl p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-[--color-muted] mb-4">
              Physical Counter Standee Preview
            </div>

            <div className="bg-white rounded-2xl p-6 text-[#09090b] shadow-2xl mx-auto max-w-sm">
              <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 mb-1">
                PRINTAP SELF-SERVICE COUNTER
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-1">{shop.name}</h2>
              <p className="text-[11px] text-zinc-500 mb-4">Scan with phone camera to beam files</p>

              <div ref={qrCanvasRef} className="inline-block p-3 bg-zinc-50 rounded-xl border border-zinc-200 mb-4">
                <QRCodeCanvas value={customerUrl} size={180} level="H" />
              </div>

              {/* Hidden SVG ref */}
              <div ref={qrSvgRef} className="hidden">
                <QRCodeSVG value={customerUrl} size={1024} level="H" />
              </div>

              <div className="grid grid-cols-3 gap-2 bg-zinc-100 p-2.5 rounded-xl text-center text-[10px] font-semibold mb-3">
                <div>1. Scan</div>
                <div className="border-x border-zinc-300">2. Select PDF</div>
                <div>3. Collect</div>
              </div>

              <div className="text-[10px] font-mono text-emerald-600 font-bold">
                UPI: {shop.upi_vpa}
              </div>
            </div>
          </div>

          {/* Download Buttons & Advice */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6">
              <h3 className="text-sm font-bold text-[--color-foreground] mb-2">
                Download Counter Display Assets
              </h3>
              <p className="text-xs text-[--color-muted] mb-6">
                Print this card and place it inside a 5x7" or A5 acrylic standee at your counter.
              </p>

              <div className="space-y-3">
                <button
                  onClick={downloadStandeePoster}
                  disabled={isExporting}
                  className="btn-primary w-full py-3 rounded-xl font-semibold text-white text-xs flex items-center justify-center gap-2"
                >
                  📥 Download Printable Counter Standee (300 DPI PNG)
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={downloadRawQrPng}
                    className="glass py-2.5 rounded-xl font-medium text-xs hover:bg-[--color-surface-light] transition"
                  >
                    Save Square PNG (1024px)
                  </button>
                  <button
                    onClick={downloadRawQrSvg}
                    className="glass py-2.5 rounded-xl font-medium text-xs hover:bg-[--color-surface-light] transition"
                  >
                    Save Vector SVG
                  </button>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 text-xs space-y-2 text-[--color-muted]">
              <div className="font-semibold text-[--color-foreground]">Display Recommendations:</div>
              <p>• Acrylic Stand: A5 or 5×7" clear vertical acrylic L-stand.</p>
              <p>• Paper: 250+ GSM cardstock for sharp QR scanning under overhead lights.</p>
              <p>• Counter Position: Directly facing the customer waiting line.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRINTERS */}
      {activeTab === "printers" && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-bold text-[--color-foreground] mb-4">
              Add / Assign Hardware Printer
            </h2>
            <form onSubmit={handleAddPrinter} className="flex gap-3 flex-wrap items-center">
              <input
                type="text"
                placeholder="Printer name as shown in Windows (e.g. HP LaserJet 1020)"
                value={newPrinterName}
                onChange={(e) => setNewPrinterName(e.target.value)}
                className="flex-1 min-w-[260px] px-4 py-2.5 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground] placeholder-[--color-muted]"
              />
              <select
                value={newPrinterRole}
                onChange={(e) => setNewPrinterRole(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground]"
              >
                <option value="bw">Black & White</option>
                <option value="color">Color Only</option>
                <option value="both">Both B&W + Color</option>
              </select>
              <button
                type="submit"
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-white"
              >
                Assign Printer
              </button>
            </form>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-bold text-[--color-foreground] mb-4">
              Configured Printers ({printers.length})
            </h2>

            {printers.length === 0 ? (
              <p className="text-xs text-[--color-muted] py-4 text-center">
                No printer assignments configured. Add a printer above or let the desktop app auto-detect.
              </p>
            ) : (
              <div className="space-y-3">
                {printers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[--color-surface-light]/60 border border-[--color-border] flex-wrap gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[--color-foreground]">
                          {p.printer_name}
                        </span>
                        {p.is_default && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 font-medium">
                            Default
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[--color-muted] uppercase tracking-wider">
                        Role: {p.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePrinter(p)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          p.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                        }`}
                      >
                        {p.is_active ? "● Online" : "○ Disabled"}
                      </button>
                      <button
                        onClick={() => handleDeletePrinter(p.id)}
                        className="px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-6 glow-sm">
              <div className="text-xs text-[--color-muted] mb-1">Direct Print Traffic</div>
              <div className="text-3xl font-bold text-[--color-foreground] mb-2">
                {printEvents.length} Jobs
              </div>
              <p className="text-xs text-[--color-muted]">
                Documents delivered peer-to-peer over local encrypted channels. Zero file storage on any cloud.
              </p>
            </div>

            <div className="glass rounded-2xl p-6 glow-sm">
              <div className="text-xs text-[--color-muted] mb-1">Direct Settlement UPI</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mb-2">
                {shop.upi_vpa}
              </div>
              <p className="text-xs text-[--color-muted]">
                100% of customer payments flow straight to your UPI account without platform cut or intermediary delay.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROFILE */}
      {activeTab === "profile" && (
        <div className="glass rounded-2xl p-6 space-y-4 max-w-xl animate-fade-in-up">
          <h2 className="text-sm font-bold text-[--color-foreground] mb-4">
            Shop Registration & Metadata
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-[--color-border]">
              <span className="text-[--color-muted]">Shop Name</span>
              <span className="font-semibold text-[--color-foreground]">{shop.name}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-[--color-border]">
              <span className="text-[--color-muted]">Dedicated Subdomain</span>
              <span className="font-mono text-indigo-400">{shop.slug || shop.id}.{ROOT_DOMAIN}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-[--color-border]">
              <span className="text-[--color-muted]">Settlement UPI</span>
              <span className="font-mono text-[--color-foreground]">{shop.upi_vpa}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-[--color-border]">
              <span className="text-[--color-muted]">Terminal UUID</span>
              <span className="font-mono text-[--color-muted] text-[10px]">{shop.id}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-[--color-border]">
              <span className="text-[--color-muted]">Account Status</span>
              <span className="text-emerald-400 font-semibold uppercase">{shop.status}</span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-[--color-muted]">Created Date</span>
              <span className="text-[--color-muted]">{new Date(shop.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
