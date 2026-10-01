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
  printer_number?: number;
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

  // Platform Fee & GST Surcharge State (Database Stored)
  const [platformFee, setPlatformFee] = useState<number>(0.82);
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [gstAmount, setGstAmount] = useState<number>(0.18);
  const [totalCharge, setTotalCharge] = useState<number>(1.00);

  const handlePlatformFeeChange = (val: number) => {
    const fee = Math.max(0, Number(val) || 0);
    setPlatformFee(fee);
    const calculatedGst = Math.round(fee * (gstPercentage / 100) * 100) / 100;
    setGstAmount(calculatedGst);
    setTotalCharge(Math.round((fee + calculatedGst) * 100) / 100);
  };

  const handleGstPercentageChange = (val: number) => {
    const pct = Math.max(0, Math.min(100, Number(val) || 0));
    setGstPercentage(pct);
    const calculatedGst = Math.round(platformFee * (pct / 100) * 100) / 100;
    setGstAmount(calculatedGst);
    setTotalCharge(Math.round((platformFee + calculatedGst) * 100) / 100);
  };

  // Unsaved changes tracking
  const initialServicesSnapshotRef = useRef<string>("");
  const [unsavedModal, setUnsavedModal] = useState<{
    isOpen: boolean;
    targetTab?: Tab;
    isLogout?: boolean;
  } | null>(null);

  // New Custom Service Form State
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState<number>(25);
  const [newServiceUnit, setNewServiceUnit] = useState<ServiceUnit>("per_copy");
  const [newServiceCategory, setNewServiceCategory] = useState<"print" | "finishing" | "addon">("finishing");

  // Sync pricing state when shop loads
  useEffect(() => {
    if (shop) {
      let b = 2;
      let c = 10;
      let ce = true;
      let list = DEFAULT_SHOP_SERVICES;
      let pf = 0.82;
      let gp = 18;
      let ga = 0.18;
      let tc = 1.00;

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
          if (s.id === "core_bw" && shop.price_bw !== undefined) return { ...s, price: Number(shop.price_bw) };
          if (s.id === "core_color" && shop.price_color !== undefined) return { ...s, price: Number(shop.price_color) };
          return s;
        });
        setServicesList(list);
      }

      if (shop.platform_fee !== undefined && shop.platform_fee !== null) {
        pf = Number(shop.platform_fee);
      }
      if (shop.gst_percentage !== undefined && shop.gst_percentage !== null) {
        gp = Number(shop.gst_percentage);
      }
      if (shop.gst_amount !== undefined && shop.gst_amount !== null) {
        ga = Number(shop.gst_amount);
      } else {
        ga = Math.round(pf * (gp / 100) * 100) / 100;
      }
      if (shop.total_charge !== undefined && shop.total_charge !== null) {
        tc = Number(shop.total_charge);
      } else {
        tc = Math.round((pf + ga) * 100) / 100;
      }

      setPlatformFee(pf);
      setGstPercentage(gp);
      setGstAmount(ga);
      setTotalCharge(tc);

      initialServicesSnapshotRef.current = JSON.stringify({
        priceBw: b,
        priceColor: c,
        colorEnabled: ce,
        servicesList: list,
        platformFee: pf,
        gstPercentage: gp,
        gstAmount: ga,
        totalCharge: tc,
      });
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

  // Check if services have unsaved modifications
  const isServicesDirty = () => {
    if (!initialServicesSnapshotRef.current) return false;
    return (
      JSON.stringify({
        priceBw,
        priceColor,
        colorEnabled,
        servicesList,
        platformFee,
        gstPercentage,
        gstAmount,
        totalCharge,
      }) !== initialServicesSnapshotRef.current
    );
  };

  // Discard edits back to baseline snapshot
  const handleDiscardServices = () => {
    if (!initialServicesSnapshotRef.current) return;
    try {
      const parsed = JSON.parse(initialServicesSnapshotRef.current);
      setPriceBw(parsed.priceBw);
      setPriceColor(parsed.priceColor);
      setColorEnabled(parsed.colorEnabled);
      setServicesList(parsed.servicesList);
      if (parsed.platformFee !== undefined) setPlatformFee(parsed.platformFee);
      if (parsed.gstPercentage !== undefined) setGstPercentage(parsed.gstPercentage);
      if (parsed.gstAmount !== undefined) setGstAmount(parsed.gstAmount);
      if (parsed.totalCharge !== undefined) setTotalCharge(parsed.totalCharge);
    } catch (e) {
      console.error("Failed to discard services", e);
    }
  };

  const handleSaveServices = async (): Promise<boolean> => {
    if (!shopId) return false;
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
          platform_fee: platformFee,
          gst_percentage: gstPercentage,
          gst_amount: gstAmount,
          total_charge: totalCharge,
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
              platform_fee: platformFee,
              gst_percentage: gstPercentage,
              gst_amount: gstAmount,
              total_charge: totalCharge,
            }
          : prev
      );
      initialServicesSnapshotRef.current = JSON.stringify({
        priceBw,
        priceColor,
        colorEnabled,
        servicesList: updatedServices,
        platformFee,
        gstPercentage,
        gstAmount,
        totalCharge,
      });
      setSaveServicesMsg("Pricing and services updated successfully!");
      setTimeout(() => setSaveServicesMsg(""), 3500);
      return true;
    } catch (err) {
      alert("Error saving: " + (err instanceof Error ? err.message : String(err)));
      return false;
    } finally {
      setIsSavingServices(false);
    }
  };

  // Guard navigation when switching tabs
  const handleSelectTab = (targetTab: Tab) => {
    if (targetTab === activeTab) return;
    if (activeTab === "services" && isServicesDirty()) {
      setUnsavedModal({
        isOpen: true,
        targetTab,
      });
      return;
    }
    setActiveTab(targetTab);
  };

  // Guard logout when dirty
  const handleLogoutRequest = () => {
    if (activeTab === "services" && isServicesDirty()) {
      setUnsavedModal({
        isOpen: true,
        isLogout: true,
      });
      return;
    }
    handleLogout();
  };

  // Modal actions
  const handleSaveAndContinue = async () => {
    setIsSavingServices(true);
    const ok = await handleSaveServices();
    setIsSavingServices(false);
    if (ok === false) return;

    const modal = unsavedModal;
    setUnsavedModal(null);
    if (modal?.isLogout) {
      handleLogout();
    } else if (modal?.targetTab) {
      setActiveTab(modal.targetTab);
    }
  };

  const handleDiscardAndContinue = () => {
    handleDiscardServices();
    const modal = unsavedModal;
    setUnsavedModal(null);
    if (modal?.isLogout) {
      handleLogout();
    } else if (modal?.targetTab) {
      setActiveTab(modal.targetTab);
    }
  };

  const handleCancelNavigation = () => {
    setUnsavedModal(null);
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
    ctx.fillText("PRINTAP SELF-SERVICE COUNTER", W / 2, 95);

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

    const nextPrinterNumber = printers.length > 0
      ? Math.max(...printers.map((p) => p.printer_number || 1)) + 1
      : 1;

    const supabase = getSupabase();
    await supabase.from("printer_assignments").insert({
      shop_id: shopId,
      printer_name: newPrinterName.trim(),
      printer_number: nextPrinterNumber,
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen cyber-bg flex items-center justify-center p-6 select-none">
        <div className="cyber-card p-8 text-center max-w-sm w-full cyber-hud-corner">
          <div className="relative w-16 h-16 mx-auto mb-5 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
            <div className="w-12 h-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 absolute shadow-[0_0_12px_#00f0ff]" />
          </div>
          <div className="font-mono text-xs tracking-widest text-cyan-400 uppercase mb-1">
            [SYS_INIT // PROTOCOL]
          </div>
          <p className="text-sm font-semibold text-slate-200">
            Connecting to Terminal Node...
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[10px] text-slate-500">
            <span>SIG_FREQ: 99.8%</span>
            <span>•</span>
            <span>P2P MESH READY</span>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in -> Cyber Access Terminal Card
  if (!shop) {
    return (
      <div className="min-h-screen cyber-bg flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-600 to-indigo-700 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(0,240,255,0.35)] mx-auto border border-cyan-400/40">
                🖨️
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#06080e] flex items-center justify-center animate-radar-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full cyber-chip-cyan text-[10px] font-mono font-bold tracking-widest uppercase mb-3">
              <span>● NODE_GATEWAY</span>
              <span>•</span>
              <span>VER 2.4.0</span>
            </div>

            <h1 className="text-3xl font-black tracking-tight cyber-text-cyan">
              Shop Admin Terminal
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-1.5">
              shop.{ROOT_DOMAIN} • Decentralized Counter Hub
            </p>
          </div>

          {/* Holographic Input Card */}
          <form
            onSubmit={handleLogin}
            className="cyber-card p-8 cyber-hud-corner space-y-5"
          >
            <div className="cyber-scanline" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
                  Terminal Shop ID (UUID)
                </label>
                <span className="text-[10px] font-mono text-cyan-400/80">
                  [AUTH_REQUIRED]
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="w-full px-4 py-3.5 cyber-input text-xs font-mono text-slate-100 placeholder-slate-600"
                  autoFocus
                />
                <span className="absolute right-3.5 top-3.5 text-xs text-cyan-400/50 font-mono">
                  #
                </span>
              </div>
            </div>

            {loginError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono flex items-center gap-2">
                <span>⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="cyber-btn-cyan w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2"
            >
              <span>Initialize Terminal Console</span>
              <span>→</span>
            </button>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Zero Cloud Storage
              </span>
              <span>Peer-to-Peer WebRTC</span>
            </div>
          </form>

          <p className="text-center text-xs font-mono text-slate-500 mt-6">
            Register new shop nodes via{" "}
            <a
              href={`https://admin.${ROOT_DOMAIN}`}
              className="text-cyan-400 hover:underline"
            >
              admin.{ROOT_DOMAIN}
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Logged In -> Full Cybercore Bento Grid Interface
  return (
    <div className="min-h-screen cyber-bg text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="px-4 sm:px-6 py-5 max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {/* ─── TOP HUD HEADER BAR ─── */}
        <header className="cyber-card p-4 sm:p-5 mb-6 cyber-hud-corner flex items-center justify-between flex-wrap gap-4 border-cyan-500/20">
          <div className="cyber-scanline" />

          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Printap"
                className="w-11 h-11 rounded-xl object-cover shadow-[0_0_15px_rgba(0,240,255,0.3)] border border-cyan-400/40"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#090d18] animate-radar-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-black tracking-tight text-white">
                  {shop.name}
                </h1>
                <span className="cyber-chip-emerald px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  TERMINAL // ONLINE
                </span>
                <span className="cyber-chip-cyan px-2 py-0.5 rounded-full text-[10px] font-mono">
                  P2P MESH
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                <span className="text-slate-500">ENDPOINT:</span>
                <a
                  href={customerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>{customerUrl}</span>
                  <span className="text-[10px]">↗</span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleCopy}
              className="cyber-btn-secondary px-3.5 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5"
              title="Copy customer print link"
            >
              {copiedLink ? (
                <span className="text-emerald-400 font-bold">✓ LINK COPIED!</span>
              ) : (
                <>
                  <span>📋</span>
                  <span>COPY PRINT LINK</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleSelectTab("qr")}
              className="cyber-btn-secondary px-3.5 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5"
              title="Open QR standee export"
            >
              <span>📐</span>
              <span className="hidden sm:inline">COUNTER STANDEE</span>
            </button>

            <button
              onClick={handleLogoutRequest}
              className="px-3.5 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/30 transition"
              title="Sign out of this terminal"
            >
              LOGOUT ⏻
            </button>
          </div>
        </header>

        {/* ─── CYBER HUD BENTO TAB NAVIGATION ─── */}
        <nav className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          {[
            { key: "overview", label: "// 01. OVERVIEW_HUD" },
            { key: "services", label: "// 02. SERVICES_MATRIX", badge: isServicesDirty() ? "MODIFIED" : null },
            { key: "qr", label: "// 03. QR_STANDEE" },
            { key: "printers", label: "// 04. PRINTER_FLEET" },
            { key: "analytics", label: "// 05. TELEMETRY_LEDGER" },
            { key: "profile", label: "// 06. NODE_PROFILE" },
          ].map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleSelectTab(t.key as Tab)}
                className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? "cyber-card cyber-hud-corner text-cyan-300 border-cyan-400/50 shadow-[0_0_20px_rgba(0,240,255,0.2)] bg-cyan-950/40"
                    : "cyber-card text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700 bg-slate-900/40"
                }`}
              >
                <span>{t.label}</span>
                {t.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 1: OVERVIEW HUD (BENTO GRID MASTER DASHBOARD) ───────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-12 gap-4 animate-fade-in-up">
            {/* HERO BENTO CELL: Live Counter Standee & WebRTC Station (Spans 8 cols on desktop) */}
            <div className="col-span-12 lg:col-span-8 cyber-card cyber-hud-corner p-6 flex flex-col justify-between border-cyan-500/30">
              <div className="cyber-scanline" />

              <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 font-mono text-[10px] text-cyan-400 uppercase tracking-widest">
                    <span>[TERMINAL_HUD // NODE: 0x{shop.id.slice(0, 6)}]</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">READY TO SPOOL</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {shop.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-lg leading-relaxed">
                    Counter QR is broadcasting. Customers scan with any smartphone camera to beam PDFs directly to your Windows printer without WhatsApp, emails, or cloud storage.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className="cyber-chip-emerald px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-radar-pulse" />
                    P2P WebRTC Active
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    LATENCY &lt; 15MS • AES-256-GCM
                  </span>
                </div>
              </div>

              {/* Bento Inner Module: QR Beamer & Quick Action Deck */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center pt-4 border-t border-slate-800/80">
                {/* QR Canvas Display */}
                <div className="sm:col-span-4 flex items-center justify-center p-3 rounded-2xl bg-white/95 border border-cyan-400/40 shadow-[0_0_25px_rgba(0,240,255,0.2)]">
                  <QRCodeCanvas value={customerUrl} size={130} level="H" />
                </div>

                {/* Live Link & Action Buttons */}
                <div className="sm:col-span-8 space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-cyan-500/20">
                    <div className="text-[10px] font-mono text-slate-400 uppercase mb-1">
                      Target Subdomain
                    </div>
                    <div className="text-sm font-mono font-bold text-cyan-300 truncate">
                      {shop.slug || shop.id}.{ROOT_DOMAIN}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => handleSelectTab("qr")}
                      className="cyber-btn-cyan px-4 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-2"
                    >
                      <span>📥</span>
                      <span>GENERATE STANDEE (300 DPI)</span>
                    </button>

                    <a
                      href={customerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cyber-btn-secondary px-4 py-2.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5"
                    >
                      <span>TEST PRINT LOOP</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO CELL 2: Core B&W Rate (Spans 4 cols) */}
            <div className="col-span-6 lg:col-span-4 cyber-card p-5 flex flex-col justify-between border-slate-800 hover:border-cyan-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  // CORE_BW_RATE
                </span>
                <span className="cyber-chip-cyan px-2 py-0.5 rounded text-[10px] font-mono">
                  MONOCHROME
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono cyber-text-cyan">
                    ₹{priceBw.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">/ PAGE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Standard A4/Legal document printing rate
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">QUICK STEP</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const next = Math.max(0.5, priceBw - 0.5);
                      handleUpdateServicePrice("core_bw", next);
                    }}
                    className="w-7 h-7 rounded-lg cyber-btn-secondary font-mono font-bold text-xs flex items-center justify-center"
                    title="Decrease price by ₹0.5"
                  >
                    -
                  </button>
                  <button
                    onClick={() => {
                      const next = priceBw + 0.5;
                      handleUpdateServicePrice("core_bw", next);
                    }}
                    className="w-7 h-7 rounded-lg cyber-btn-secondary font-mono font-bold text-xs flex items-center justify-center text-cyan-400"
                    title="Increase price by ₹0.5"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* BENTO CELL 3: Core Color Rate (Spans 4 cols) */}
            <div className="col-span-6 lg:col-span-4 cyber-card p-5 flex flex-col justify-between border-slate-800 hover:border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  // CORE_COLOR_RATE
                </span>
                <span className="cyber-chip-purple px-2 py-0.5 rounded text-[10px] font-mono">
                  FULL COLOR
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono cyber-text-purple">
                    ₹{priceColor.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">/ PAGE</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  High-res CMYK color reproduction
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">HARDWARE STATUS</span>
                <button
                  onClick={() => handleToggleService("core_color")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition flex items-center gap-1.5 ${
                    colorEnabled
                      ? "cyber-chip-emerald"
                      : "bg-slate-800/80 text-slate-400 border border-slate-700"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${colorEnabled ? "bg-emerald-400" : "bg-slate-500"}`} />
                  {colorEnabled ? "ONLINE" : "OFFLINE"}
                </button>
              </div>
            </div>

            {/* BENTO CELL 4: Surcharge & GST Gauge (Spans 4 cols) */}
            <div className="col-span-6 lg:col-span-4 cyber-card p-5 flex flex-col justify-between border-slate-800 hover:border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  // SURCHARGE_GAUGE
                </span>
                <span className="cyber-chip-emerald px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  AUTO-TAX
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono cyber-text-emerald">
                    ₹{totalCharge.toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">TOTAL</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                  <div>BASE FEE: ₹{platformFee.toFixed(2)}</div>
                  <div className="text-slate-500">GST ({gstPercentage}%): ₹{gstAmount.toFixed(2)}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>DATABASE SYNCED</span>
                <button
                  onClick={() => handleSelectTab("services")}
                  className="text-cyan-400 hover:underline"
                >
                  CONFIGURE →
                </button>
              </div>
            </div>

            {/* BENTO CELL 5: Hardware Printer Cluster (Spans 4 cols) */}
            <div className="col-span-6 lg:col-span-4 cyber-card p-5 flex flex-col justify-between border-slate-800 hover:border-cyan-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  // PRINTER_HARDWARE
                </span>
                <span className="cyber-chip-cyan px-2 py-0.5 rounded text-[10px] font-mono">
                  SPOOL_QUEUE
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono text-white">
                    {printers.filter((p) => p.is_active).length}
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    / {printers.length} ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {printers.find((p) => p.is_default)?.printer_name || "No default printer set"}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>DESKTOP SPOOLER</span>
                <button
                  onClick={() => handleSelectTab("printers")}
                  className="text-cyan-400 hover:underline"
                >
                  MANAGE FLEET →
                </button>
              </div>
            </div>

            {/* BENTO CELL 6: Direct Merchant UPI Settlement Vault (Spans 6 cols) */}
            <div className="col-span-12 md:col-span-6 cyber-card p-5 flex flex-col justify-between border-slate-800 hover:border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  // DIRECT_SETTLEMENT_VAULT
                </span>
                <span className="cyber-chip-emerald px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  100% TO SHOP
                </span>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">
                  Customer payments flow instantly to your UPI account:
                </div>
                <div className="text-lg sm:text-xl font-mono font-black text-emerald-400 truncate bg-slate-950/80 p-3 rounded-xl border border-emerald-500/20">
                  {shop.upi_vpa}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>ZERO PLATFORM CUT ON PRINTS</span>
                <span className="text-emerald-400">VERIFIED VPA</span>
              </div>
            </div>

            {/* BENTO CELL 7: Lifetime Print Volume & Privacy Certificate (Spans 6 cols) */}
            <div className="col-span-12 md:col-span-6 cyber-card p-5 flex flex-col justify-between border-slate-800 hover:border-cyan-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  // P2P_VOLUME_COUNTER
                </span>
                <span className="cyber-chip-cyan px-2 py-0.5 rounded text-[10px] font-mono">
                  SHRED_PROTOCOL
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-3xl sm:text-4xl font-black font-mono text-cyan-300">
                    {printEvents.length}
                  </span>
                  <span className="text-xs font-mono text-slate-400">JOBS COMPLETED</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  All documents transferred memory-only via encrypted WebRTC. Auto-shredded upon spooling.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span className="text-emerald-400">ZERO CLOUD STORAGE</span>
                <span>AUDITED P2P</span>
              </div>
            </div>

            {/* BENTO CELL 8: Transmission Stream / Realtime Session Stream (Spans 12 cols) */}
            <div className="col-span-12 cyber-card p-6 border-slate-800">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                    // REALTIME_TRANSMISSION_STREAM
                  </span>
                  <span className="cyber-chip-cyan px-2 py-0.5 rounded text-[10px] font-mono">
                    LIVE_LOGS
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  Showing latest {printEvents.length} telemetry records
                </span>
              </div>

              {printEvents.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl font-mono text-xs text-slate-500">
                  [STREAM_IDLE] Awaiting customer document uploads at counter. Session tokens will stream here in real time.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                        <th className="pb-3 px-3">Session Hash</th>
                        <th className="pb-3 px-3">Timestamp</th>
                        <th className="pb-3 px-3">Protocol</th>
                        <th className="pb-3 px-3 text-right">Spool State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {printEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-cyan-500/5 transition">
                          <td className="py-3 px-3 text-cyan-300 font-bold">
                            #{ev.session_id.slice(0, 10)}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(ev.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            WEBRTC_DATA_CHANNEL
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="cyber-chip-emerald px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              ✓ SPOOLED & SHREDDED
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

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 2: SERVICES & RATES MATRIX (BENTO GRID) ─────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "services" && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Top Action & Save Bento Card */}
            <div className="cyber-card p-6 cyber-hud-corner border-cyan-500/30 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400 uppercase tracking-widest mb-1">
                  <span>// RATE_MANAGEMENT_STATION</span>
                  {isServicesDirty() && (
                    <span className="text-amber-400 font-bold animate-pulse">
                      ● UNSAVED EDITS DETECTED
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Pricing & Customer Services Matrix
                </h2>
                <p className="text-xs text-slate-400 max-w-xl mt-1">
                  Adjust per-page document print rates, configure convenience surcharge and GST tax percentages, and offer customized print finishing add-ons.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {saveServicesMsg && (
                  <span className="cyber-chip-emerald px-3 py-1 rounded-xl text-xs font-mono font-bold animate-fade-in-up">
                    ✓ {saveServicesMsg}
                  </span>
                )}

                {isServicesDirty() && (
                  <button
                    type="button"
                    onClick={handleDiscardServices}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-mono font-semibold text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition"
                  >
                    DISCARD
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveServices}
                  disabled={isSavingServices}
                  className="cyber-btn-cyan px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {isSavingServices ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      <span>COMMITTING...</span>
                    </>
                  ) : (
                    <>
                      <span>💾 SAVE SERVICES & RATES</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Core Document Printing Bento Deck */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                  // CORE_DOCUMENT_PRINTING (STANDARD TIERS)
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  ● ALWAYS ACCESSIBLE AT COUNTER
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Core 1: Black & White */}
                <div className="cyber-card p-6 border-slate-800 hover:border-cyan-500/30">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg shadow">
                        📄
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          Black & White Printing
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Monochrome Standard (A4 / Legal)
                        </div>
                      </div>
                    </div>
                    <span className="cyber-chip-cyan px-2.5 py-0.5 rounded text-[10px] font-mono font-bold">
                      CORE • DEFAULT
                    </span>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <label className="text-xs font-mono text-slate-400">
                      RATE PER PAGE:
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-cyan-400 font-mono">₹</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={priceBw}
                        onChange={(e) => handleUpdateServicePrice("core_bw", Math.max(0.5, Number(e.target.value)))}
                        className="w-24 px-3 py-1.5 rounded-lg cyber-input font-mono font-bold text-sm text-center text-white"
                      />
                      <span className="text-xs font-mono text-slate-500">/ pg</span>
                    </div>
                  </div>
                </div>

                {/* Core 2: Color Printing */}
                <div className="cyber-card p-6 border-slate-800 hover:border-purple-500/30">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-lg shadow border border-purple-400/30">
                        🎨
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          Color Printing
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Full Color Reproduction (CMYK)
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleService("core_color")}
                      className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition flex items-center gap-1.5 ${
                        colorEnabled
                          ? "cyber-chip-emerald"
                          : "bg-slate-800/80 text-slate-400 border border-slate-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${colorEnabled ? "bg-emerald-400" : "bg-slate-500"}`} />
                      {colorEnabled ? "ENABLED" : "OUT OF INK / OFFLINE"}
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <label className="text-xs font-mono text-slate-400">
                      RATE PER PAGE:
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-purple-400 font-mono">₹</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={priceColor}
                        onChange={(e) => handleUpdateServicePrice("core_color", Math.max(1, Number(e.target.value)))}
                        className="w-24 px-3 py-1.5 rounded-lg cyber-input font-mono font-bold text-sm text-center text-white"
                      />
                      <span className="text-xs font-mono text-slate-500">/ pg</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Convenience Fee & GST Surcharge Bento Console */}
            <div className="cyber-card p-6 cyber-hud-corner border-emerald-500/20">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                    // CONVENIENCE_FEE_AND_TAX_MATRIX
                  </span>
                  <span className="cyber-chip-emerald px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                    DATABASE SYNCED
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  REAL-TIME CUSTOMER ACCREDITATION
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-5 max-w-xl">
                Set your base convenience charge and GST rate. Total surcharge is automatically computed and broken down in the customer price drawer.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Input 1: Base Platform Fee */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <label className="block text-[11px] font-mono font-bold text-slate-300 uppercase mb-2">
                    Base Convenience Fee (₹)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={platformFee}
                      onChange={(e) => handlePlatformFeeChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 cyber-input text-sm font-mono font-bold text-cyan-300"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">
                    Platform fee before tax
                  </span>
                </div>

                {/* Input 2: GST Percentage */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <label className="block text-[11px] font-mono font-bold text-slate-300 uppercase mb-2">
                    GST Rate Percentage (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={gstPercentage}
                      onChange={(e) => handleGstPercentageChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 cyber-input text-sm font-mono font-bold text-center text-white"
                    />
                    <span className="font-mono font-bold text-slate-400">%</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">
                    Statutory GST surcharge
                  </span>
                </div>

                {/* Gauge 1: Auto-calculated GST */}
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col justify-between">
                  <div className="text-[10px] font-mono font-bold text-purple-300 uppercase tracking-widest">
                    Auto-Calculated GST
                  </div>
                  <div className="text-2xl font-black font-mono cyber-text-purple my-1">
                    ₹{gstAmount.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {gstPercentage}% on ₹{platformFee.toFixed(2)}
                  </div>
                </div>

                {/* Gauge 2: Total Customer Fee */}
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col justify-between">
                  <div className="text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-widest">
                    Customer Surcharge
                  </div>
                  <div className="text-2xl font-black font-mono cyber-text-emerald my-1">
                    ₹{totalCharge.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400/80">
                    ₹{platformFee.toFixed(2)} fee + ₹{gstAmount.toFixed(2)} tax
                  </div>
                </div>
              </div>

              {/* Callout Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/20 text-xs font-mono text-slate-300 flex items-center gap-2.5">
                <span>👁️</span>
                <span>
                  Customer price drawer displays:{" "}
                  <strong className="text-emerald-300">GST and other charges: ₹{totalCharge.toFixed(2)}</strong>{" "}
                  (breakdown: <code className="text-cyan-300">₹{platformFee.toFixed(2)}</code> +{" "}
                  <code className="text-cyan-300">₹{gstAmount.toFixed(2)}</code> GST)
                </span>
              </div>
            </div>

            {/* Custom & Finishing Services Bento Section */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                  // ADDITIONAL_SERVICES_INVENTORY
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCustom((p) => !p)}
                  className="cyber-btn-secondary px-3 py-1.5 rounded-lg text-xs font-mono font-semibold"
                >
                  {showAddCustom ? "− CLOSE FORM" : "+ ADD CUSTOM SERVICE"}
                </button>
              </div>

              {/* Add Custom Form */}
              {showAddCustom && (
                <form
                  onSubmit={handleAddCustomService}
                  className="cyber-card p-5 mb-4 border-cyan-500/40 space-y-4 animate-fade-in-up"
                >
                  <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
                    [REGISTER_NEW_SHOP_SERVICE]
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-slate-400 mb-1">
                        SERVICE NAME
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Spiral Binding, Glossy Sticker, Thesis Hardcover"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        className="w-full px-3 py-2 cyber-input text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        PRICE (₹)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(Number(e.target.value))}
                        className="w-full px-3 py-2 cyber-input text-xs font-bold text-cyan-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        BILLING UNIT
                      </label>
                      <select
                        value={newServiceUnit}
                        onChange={(e) => setNewServiceUnit(e.target.value as ServiceUnit)}
                        className="w-full px-3 py-2 cyber-input text-xs"
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
                      className="px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      className="cyber-btn-cyan px-4 py-1.5 rounded-lg text-xs font-mono font-bold"
                    >
                      ADD SERVICE TO MENU
                    </button>
                  </div>
                </form>
              )}

              {/* Table of Custom Services */}
              <div className="cyber-card overflow-hidden border-slate-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] bg-slate-950/40">
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price (₹)</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4">Toggle</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {servicesList
                      .filter((s) => !s.isCore)
                      .map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-cyan-500/5 transition ${
                            !item.enabled ? "opacity-50" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-white">
                            {item.name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="cyber-chip-cyan px-2 py-0.5 rounded text-[10px] uppercase">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-cyan-400 font-bold">₹</span>
                              <input
                                type="number"
                                min="0"
                                value={item.price}
                                onChange={(e) =>
                                  handleUpdateServicePrice(item.id, Number(e.target.value))
                                }
                                className="w-20 px-2 py-1 cyber-input text-xs font-bold text-white"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-400 capitalize">
                            {item.unit.replace("_", " ")}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleService(item.id)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1.5 ${
                                item.enabled
                                  ? "cyber-chip-emerald"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.enabled ? "bg-emerald-400" : "bg-slate-500"
                                }`}
                              />
                              {item.enabled ? "ENABLED" : "DISABLED"}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.id.startsWith("custom_") ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteService(item.id)}
                                className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
                              >
                                DELETE
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500">PRESET</span>
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

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 3: COUNTER QR & STANDEE (BENTO GRID) ────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "qr" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in-up">
            {/* Left: Standee Acrylic Physical Simulation Preview (5 cols) */}
            <div className="md:col-span-5 cyber-card p-6 cyber-hud-corner border-cyan-500/30 flex flex-col items-center text-center">
              <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase mb-4">
                // COUNTER_ACRYLIC_HOLOGRAPHIC_PREVIEW
              </div>

              {/* Physical Acrylic Card Mockup */}
              <div className="bg-white rounded-2xl p-6 text-slate-900 shadow-[0_0_50px_rgba(0,240,255,0.25)] border-4 border-slate-800 max-w-sm w-full">
                <div className="flex justify-center mb-2">
                  <img
                    src="/logo.png"
                    alt="Printap"
                    className="w-9 h-9 rounded-xl object-cover shadow border border-slate-300"
                  />
                </div>
                <div className="text-[9px] font-black tracking-widest uppercase text-slate-500 mb-1">
                  PRINTAP SELF-SERVICE COUNTER
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-950 mb-1">
                  {shop.name}
                </h2>
                <p className="text-[10px] text-slate-500 mb-4 font-medium">
                  Scan with phone camera to beam files
                </p>

                <div
                  ref={qrCanvasRef}
                  className="inline-block p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 shadow-inner mb-4"
                >
                  <QRCodeCanvas value={customerUrl} size={180} level="H" />
                </div>

                {/* Hidden SVG reference for vector export */}
                <div ref={qrSvgRef} className="hidden">
                  <QRCodeSVG value={customerUrl} size={1024} level="H" />
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2.5 rounded-xl text-center text-[10px] font-bold text-slate-700 mb-3">
                  <div>1. Scan</div>
                  <div className="border-x border-slate-300">2. Upload</div>
                  <div>3. Collect</div>
                </div>

                <div className="text-[11px] font-mono text-emerald-700 font-black">
                  UPI: {shop.upi_vpa}
                </div>
              </div>
            </div>

            {/* Right: Export Deck & Signage Advice (7 cols) */}
            <div className="md:col-span-7 space-y-4">
              <div className="cyber-card p-6 cyber-hud-corner border-slate-800">
                <div className="flex items-center gap-2 mb-2 font-mono text-[10px] text-cyan-400 uppercase tracking-widest">
                  <span>// EXPORT_ENGINE</span>
                  <span>•</span>
                  <span>HIGH_RES_ASSETS</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Download Counter Signage Assets
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Print the standee graphic on heavy cardstock (250+ GSM) and insert into an A5 or 5x7" clear acrylic L-stand on your front desk.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={downloadStandeePoster}
                    disabled={isExporting}
                    className="cyber-btn-cyan w-full py-3.5 rounded-xl font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <span>📥</span>
                    <span>DOWNLOAD PRINTABLE STANDEE (300 DPI PNG)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={downloadRawQrPng}
                      className="cyber-btn-secondary py-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <span>SAVE SQUARE PNG</span>
                      <span className="text-[10px] text-slate-400">(1024px)</span>
                    </button>
                    <button
                      onClick={downloadRawQrSvg}
                      className="cyber-btn-secondary py-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <span>SAVE VECTOR SVG</span>
                      <span className="text-[10px] text-slate-400">(Infinite)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Placement & Lighting Guidelines Bento Cell */}
              <div className="cyber-card p-6 border-slate-800 font-mono text-xs space-y-3">
                <div className="text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                  [HARDWARE_DEPLOYMENT_DIRECTIVES]
                </div>
                <ul className="space-y-2 text-slate-400 text-[11px]">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400">01.</span>
                    <span><strong>Acrylic Stand:</strong> Standard A5 or 5x7" vertical clear acrylic standee placed facing the customer queue.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400">02.</span>
                    <span><strong>Cardstock Quality:</strong> Print at 300 DPI on 250+ GSM paper to prevent glare and paper curl under counter lighting.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400">03.</span>
                    <span><strong>Lighting Angle:</strong> Position slightly tilted away from direct ceiling spotlights for immediate phone camera focus.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 4: PRINTER FLEET (BENTO GRID) ───────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "printers" && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Add Printer Bento Card */}
            <div className="cyber-card p-6 cyber-hud-corner border-cyan-500/30">
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">
                // HARDWARE_BRIDGE // ASSIGN_NEW_SPOOLER
              </div>
              <h2 className="text-lg font-bold text-white mb-4">
                Assign Hardware Printer Terminal
              </h2>

              <form onSubmit={handleAddPrinter} className="flex gap-3 flex-wrap items-center">
                <input
                  type="text"
                  placeholder="Windows printer name (e.g. HP LaserJet 1020, Canon LBP2900)"
                  value={newPrinterName}
                  onChange={(e) => setNewPrinterName(e.target.value)}
                  className="flex-1 min-w-[280px] px-4 py-2.5 cyber-input text-xs font-mono text-white placeholder-slate-500"
                />
                <select
                  value={newPrinterRole}
                  onChange={(e) => setNewPrinterRole(e.target.value as any)}
                  className="px-3.5 py-2.5 cyber-input text-xs font-mono text-white"
                >
                  <option value="bw">ROLE: Black & White Only</option>
                  <option value="color">ROLE: Color Only</option>
                  <option value="both">ROLE: Both B&W + Color</option>
                </select>
                <button
                  type="submit"
                  className="cyber-btn-cyan px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider"
                >
                  + ASSIGN PRINTER
                </button>
              </form>
            </div>

            {/* Configured Hardware Node Matrix */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                  // ASSIGNED_HARDWARE_NODES ({printers.length})
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  AUTO-SPOOLS VIA PRINTAP DESKTOP
                </span>
              </div>

              {printers.length === 0 ? (
                <div className="cyber-card p-8 text-center font-mono text-xs text-slate-500 border-dashed border-slate-800">
                  [NO_PRINTERS_ASSIGNED] Add your Windows printer name above or connect via the Printap Desktop bridge.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {printers.map((p) => (
                    <div
                      key={p.id}
                      className="cyber-card p-5 border-slate-800 hover:border-cyan-500/40 flex items-center justify-between flex-wrap gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white">
                            {p.printer_name}
                          </span>
                          <span className="cyber-chip-cyan px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                            #{p.printer_number || 1}
                          </span>
                          {p.is_default && (
                            <span className="cyber-chip-purple px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 uppercase">
                          ROLE: <strong className="text-cyan-300">{p.role}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePrinter(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                            p.is_active
                              ? "cyber-chip-emerald"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.is_active ? "bg-emerald-400" : "bg-slate-500"
                            }`}
                          />
                          {p.is_active ? "ONLINE" : "DISABLED"}
                        </button>
                        <button
                          onClick={() => handleDeletePrinter(p.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete printer assignment"
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 5: ANALYTICS & TELEMETRY LEDGER ─────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
            <div className="cyber-card p-6 cyber-hud-corner border-slate-800">
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">
                // TELEMETRY_THROUGHPUT
              </div>
              <h3 className="text-base font-bold text-white mb-4">
                P2P Document Transmission Volume
              </h3>
              <div className="text-4xl font-black font-mono cyber-text-cyan mb-2">
                {printEvents.length} Documents
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Files are streamed directly from customer browsers to your local PC RAM over peer-to-peer WebRTC data channels. Zero cloud database storage liability.
              </p>
            </div>

            <div className="cyber-card p-6 cyber-hud-corner border-slate-800">
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-1">
                // SETTLEMENT_ROUTING
              </div>
              <h3 className="text-base font-bold text-white mb-4">
                Direct Merchant UPI Channel
              </h3>
              <div className="text-2xl font-black font-mono cyber-text-emerald mb-2 truncate">
                {shop.upi_vpa}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                100% of customer print payments go straight to your bank account via UPI QR. No escrow, no platform withdrawal limits.
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 6: SHOP PROFILE & NODE CREDENTIALS ──────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "profile" && (
          <div className="cyber-card p-6 cyber-hud-corner max-w-2xl border-slate-800 space-y-4 animate-fade-in-up">
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">
              // TERMINAL_NODE_MANIFEST
            </div>
            <h2 className="text-lg font-bold text-white mb-4">
              Registered Shop Metadata
            </h2>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">SHOP NAME:</span>
                <span className="font-bold text-white">{shop.name}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">DEDICATED SUBDOMAIN:</span>
                <span className="font-bold text-cyan-300">
                  {shop.slug || shop.id}.{ROOT_DOMAIN}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">SETTLEMENT UPI:</span>
                <span className="font-bold text-emerald-300">{shop.upi_vpa}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">TERMINAL UUID:</span>
                <span className="text-slate-400 text-[11px]">{shop.id}</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">STATUS:</span>
                <span className="cyber-chip-emerald px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                  {shop.status}
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-slate-400">CREATED AT:</span>
                <span className="text-slate-300">
                  {new Date(shop.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── UNSAVED CHANGES CONFIRMATION MODAL ─── */}
        {unsavedModal?.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={handleCancelNavigation}
          >
            <div
              className="w-full max-w-md p-6 rounded-2xl cyber-card border-amber-500/40 cyber-hud-corner shadow-[0_0_40px_rgba(245,158,11,0.2)] space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 font-mono text-[10px] text-amber-400 uppercase tracking-widest">
                <span>⚠️ [UNSAVED_CHANGES_WARNING]</span>
              </div>
              <h3 className="text-base font-bold text-white">
                Unsaved Edits in Services & Rates
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                You have modified your pricing or surcharge matrix without committing changes to the database. How would you like to proceed?
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCancelNavigation}
                  disabled={isSavingServices}
                  className="px-3.5 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAndContinue}
                  disabled={isSavingServices}
                  className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition"
                >
                  DISCARD
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndContinue}
                  disabled={isSavingServices}
                  className="cyber-btn-cyan px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider"
                >
                  {isSavingServices ? "SAVING..." : "COMMIT & PROCEED"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
