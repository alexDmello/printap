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
import { AdminSidebar, type AdminTab } from "@/components/admin/AdminSidebar";
import { AdminAnalytics, type PrintEvent } from "@/components/admin/AdminAnalytics";
import {
  IconMenu,
  IconCopy,
  IconCheck,
  IconExternal,
  IconPrinter,
  IconAnalytics,
  IconServices,
  IconQr,
  IconShieldCheck,
} from "@/components/admin/AdminIcons";

type Tab = AdminTab;

interface PrinterAssignment {
  id: string;
  printer_name: string;
  printer_number?: number;
  role: "bw" | "color" | "both";
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export default function ShopAdminPage() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
      .limit(50);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh px-4">
        <div className="glass-bento rounded-3xl p-8 text-center max-w-xs w-full shadow-lg">
          <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-semibold text-slate-800">Connecting Terminal...</p>
          <p className="text-[11px] text-slate-400 mt-1">Verifying encrypted counter session</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Glassmorphic Sign In Card
  if (!shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-mesh">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 mx-auto mb-3">
              🏪
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Shop Admin Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              shop.{ROOT_DOMAIN} • Counter Management & Signage
            </p>
          </div>

          <form onSubmit={handleLogin} className="glass-bento rounded-3xl p-7 glow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Terminal Shop ID (UUID)
              </label>
              <input
                type="text"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition font-mono"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 rounded-xl font-semibold text-white text-xs shadow-md shadow-slate-900/10"
            >
              Sign In to Counter Terminal →
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Need a shop account? Contact platform operations at admin.{ROOT_DOMAIN}
          </p>
        </div>
      </div>
    );
  }

  const activePrintersCount = printers.filter((p) => p.is_active).length;

  return (
    <div className="min-h-screen bg-mesh text-slate-900 flex">
      {/* ─── Glassmorphic Sidebar Navigation ─── */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        shop={shop}
        customerUrl={customerUrl}
        activePrintersCount={activePrintersCount}
        totalPrintsCount={printEvents.length}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        onLogoutRequest={handleLogoutRequest}
        copiedLink={copiedLink}
        onCopyLink={handleCopy}
      />

      {/* ─── Main Content Wrapper ─── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Top Mobile Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              aria-label="Open navigation menu"
            >
              <IconMenu size={20} />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900 truncate max-w-[180px]">
                {shop.name}
              </h1>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Terminal Live
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold glass border border-slate-200 text-slate-700"
          >
            {copiedLink ? "✓ Copied" : "Copy Link"}
          </button>
        </header>

        {/* Desktop Top Header Bar inside Main Area */}
        <header className="hidden lg:flex items-center justify-between px-8 py-5 border-b border-slate-200/60 bg-white/40 backdrop-blur-sm sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">
                {activeTab === "overview" && "Counter Overview"}
                {activeTab === "analytics" && "Revenue & Printing Analytics"}
                {activeTab === "services" && "Services & Rates Configuration"}
                {activeTab === "qr" && "Counter Standee & Signage"}
                {activeTab === "printers" && "Hardware Printer Assignments"}
                {activeTab === "profile" && "Shop Terminal Profile"}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                ● Live Terminal
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === "overview" && "Live terminal status, customer traffic and quick counter controls."}
              {activeTab === "analytics" && "Detailed volume trends, net profit margins, rush hours and ledger."}
              {activeTab === "services" && "Manage Xerox rates, color printing, GST and custom finishing services."}
              {activeTab === "qr" && "Downloadable high-res standees and counter print signage."}
              {activeTab === "printers" && "Assign local network and USB printers for customer spools."}
              {activeTab === "profile" && "Shop registration, subdomain routing, and direct settlement UPI."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold glass hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 transition flex items-center gap-1.5 shadow-sm"
            >
              {copiedLink ? (
                <>
                  <IconCheck size={14} className="text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Print Link Copied!</span>
                </>
              ) : (
                <>
                  <IconCopy size={14} />
                  <span>Copy Customer Link</span>
                </>
              )}
            </button>

            <a
              href={customerUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold btn-primary text-white flex items-center gap-1.5"
            >
              <span>Test Customer View</span>
              <IconExternal size={13} />
            </a>
          </div>
        </header>

        {/* ─── Scrollable Page Body ─── */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: OVERVIEW (BENTO GRID DESIGN) */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fade-in-up">
              {/* Bento Grid Top Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Bento Card 1 (Span 2): Live Customer Print Domain */}
                <div className="md:col-span-2 glass-bento rounded-3xl p-6 glow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Customer Print Endpoint
                      </span>
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">
                        ⚡ Direct P2P Link
                      </span>
                    </div>

                    <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-600 truncate mb-2">
                      {shop.slug || shop.id}.{ROOT_DOMAIN}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                      Customers scan the counter acrylic standee or open this link directly to beam PDF files securely into your spool.
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px] truncate max-w-[240px]">
                      {customerUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5"
                    >
                      {copiedLink ? <IconCheck size={13} className="text-emerald-600" /> : <IconCopy size={13} />}
                      <span>{copiedLink ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Bento Card 2: Total Prints with Jump to Analytics */}
                <div className="glass-bento rounded-3xl p-6 glow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Dispatched Prints
                      </span>
                      <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                        <IconAnalytics size={16} />
                      </div>
                    </div>

                    <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
                      {printEvents.length}
                    </div>
                    <p className="text-xs text-slate-500">
                      Direct P2P print completions
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSelectTab("analytics")}
                      className="w-full text-left text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center justify-between"
                    >
                      <span>View Revenue & Trends</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Bento Card 3: Active Printers with Jump to Printers */}
                <div className="glass-bento rounded-3xl p-6 glow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Hardware Printers
                      </span>
                      <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                        <IconPrinter size={16} />
                      </div>
                    </div>

                    <div className="text-3xl font-extrabold text-emerald-600 tracking-tight mb-1">
                      {activePrintersCount}{" "}
                      <span className="text-sm font-semibold text-slate-400">/ {printers.length}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Active spool destinations
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSelectTab("printers")}
                      className="w-full text-left text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition flex items-center justify-between"
                    >
                      <span>Configure Printers</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Bento Card 4 (Span 2): Counter Acrylic Stand Ready */}
                <div className="md:col-span-2 glass-bento rounded-3xl p-6 glow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="space-y-3 max-w-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        📱 Acrylic Standee
                      </span>
                      <span className="text-xs font-bold text-slate-900">300 DPI Ready</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Counter QR Signage Stand
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Place this QR code at your shop counter. Customers scan with their phone camera to beam documents without sending WhatsApp messages or emails.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={downloadStandeePoster}
                        disabled={isExporting}
                        className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center gap-1.5"
                      >
                        <span>📥 Download Standee</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTab("qr")}
                        className="px-3 py-2 rounded-xl text-xs font-semibold glass hover:bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        All Assets →
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200/80 flex-shrink-0">
                    <QRCodeCanvas value={customerUrl} size={110} level="H" />
                  </div>
                </div>

                {/* Bento Card 5 (Span 2): Active Rates & Platform Fee Snapshot */}
                <div className="md:col-span-2 glass-bento rounded-3xl p-6 glow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Counter Rates Snapshot
                      </span>
                      <span className="text-xs font-semibold text-slate-600">Current Menu</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                          B&W Standard
                        </span>
                        <div className="text-xl font-bold text-slate-900 mt-0.5">
                          ₹{priceBw} <span className="text-xs font-normal text-slate-500">/page</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                        <span className="text-[10px] text-indigo-500 font-semibold block uppercase">
                          Full Color
                        </span>
                        <div className="text-xl font-bold text-indigo-900 mt-0.5">
                          ₹{priceColor} <span className="text-xs font-normal text-indigo-500">/page</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/50">
                      <span>Total Customer Surcharge</span>
                      <span className="font-mono font-bold text-slate-800">
                        ₹{totalCharge.toFixed(2)} (Fee ₹{platformFee.toFixed(2)} + GST {gstPercentage}%)
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-3">
                    <button
                      type="button"
                      onClick={() => handleSelectTab("services")}
                      className="w-full text-left text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center justify-between"
                    >
                      <span>Update Rates & Services</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bento Card 6: Recent Events Stream Table */}
              <div className="glass-bento rounded-3xl p-6 glow-sm border border-slate-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Recent Print Sessions Feed
                    </h3>
                    <p className="text-xs text-slate-500">
                      Latest document prints completed over peer-to-peer WebRTC.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTab("analytics")}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    View Full Ledger ({printEvents.length}) →
                  </button>
                </div>

                {printEvents.length === 0 ? (
                  <div className="text-center py-10 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500 font-medium">
                      No print jobs recorded yet. When a customer beams a file, sessions will show here in real time.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="pb-3 px-3">Session Hash</th>
                          <th className="pb-3 px-3">Timestamp</th>
                          <th className="pb-3 px-3">Channel</th>
                          <th className="pb-3 px-3 text-right">Spool Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {printEvents.slice(0, 6).map((ev) => (
                          <tr key={ev.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-3 font-mono text-slate-900">
                              #{ev.session_id.slice(0, 10)}
                            </td>
                            <td className="py-3 px-3 text-slate-500">
                              {new Date(ev.created_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                                P2P Encrypted
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Spooled & Shredded
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

          {/* TAB 2: ANALYTICS & LEDGER (COMPREHENSIVE BENTO SUITE) */}
          {activeTab === "analytics" && (
            <AdminAnalytics
              shop={shop}
              printEvents={printEvents}
              priceBw={priceBw}
              priceColor={priceColor}
              onRefresh={loadShopData}
            />
          )}

          {/* TAB 3: SERVICES & RATES */}
          {activeTab === "services" && (
            <div className="space-y-6 animate-fade-in-up">
              {/* Header Card & Save Action */}
              <div className="flex items-center justify-between flex-wrap gap-4 glass-bento rounded-3xl p-6 glow-sm">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Services & Custom Pricing Management
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-lg">
                    Configure your shop's per-page printing rates, toggle color printing availability, and manage additional finishing services offered to customers.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saveServicesMsg && (
                    <span className="text-xs font-semibold text-emerald-600 animate-fade-in-up">
                      ✓ {saveServicesMsg}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveServices}
                    disabled={isSavingServices}
                    className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-slate-900/10"
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

              {/* Core Document Printing Services */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Core Printing Services (Standard Document Xerox)
                  </h3>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    ● Always accessible to customer phone scans
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Core 1: Black & White */}
                  <div className="glass-bento rounded-2xl p-5 glow-sm border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm shadow">
                          📄
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            Black & White Printing
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Monochrome standard A4/Legal
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        Active • Core
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-600">
                        Price per Page (₹)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">₹</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={priceBw}
                          onChange={(e) => handleUpdateServicePrice("core_bw", Math.max(0.5, Number(e.target.value)))}
                          className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 font-bold text-center focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        <span className="text-xs text-slate-400">/ page</span>
                      </div>
                    </div>
                  </div>

                  {/* Core 2: Color Printing */}
                  <div className="glass-bento rounded-2xl p-5 glow-sm border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white flex items-center justify-center text-sm shadow">
                          🎨
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            Color Printing
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Full color A4/Photo reproduction
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleService("core_color")}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1.5 ${
                          colorEnabled
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${colorEnabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {colorEnabled ? "Enabled" : "Disabled (Out of Ink)"}
                      </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-600">
                        Price per Page (₹)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">₹</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={priceColor}
                          onChange={(e) => handleUpdateServicePrice("core_color", Math.max(1, Number(e.target.value)))}
                          className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 font-bold text-center focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        <span className="text-xs text-slate-400">/ page</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Fee & GST Surcharge Configuration */}
              <div className="glass-bento rounded-3xl p-6 glow-sm border border-slate-200/80">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      Platform Fee & GST Surcharge Configuration
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                      Auto-Calculates
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Stored in Database • Live Customer Breakdown
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-5 max-w-xl">
                  Enter your base platform convenience fee and GST percentage. The tax breakdown and total surcharge are automatically calculated in real time and saved to the database.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* Input 1: Platform Fee */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Base Platform Fee (₹)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={platformFee}
                        onChange={(e) => handlePlatformFeeChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5 block">
                      Net fee before tax
                    </span>
                  </div>

                  {/* Input 2: GST Percentage */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      GST Percentage (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={gstPercentage}
                        onChange={(e) => handleGstPercentageChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500 text-center"
                      />
                      <span className="text-sm font-bold text-slate-400">%</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5 block">
                      Tax percentage rate
                    </span>
                  </div>

                  {/* Auto-calc Box 1: Calculated GST */}
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200/60 flex flex-col justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      Calculated GST
                    </div>
                    <div className="text-2xl font-black font-mono text-indigo-900 my-1">
                      ₹{gstAmount.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-indigo-600/70">
                      {gstPercentage}% on ₹{platformFee.toFixed(2)}
                    </div>
                  </div>

                  {/* Auto-calc Box 2: Total Customer Fee */}
                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 flex flex-col justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Total Customer Surcharge
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-700 my-1">
                      ₹{totalCharge.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-emerald-600">
                      ₹{platformFee.toFixed(2)} fee + ₹{gstAmount.toFixed(2)} GST
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center gap-2.5">
                  <span>👁️</span>
                  <span>
                    Customer price drawer displays:{" "}
                    <strong className="text-slate-900">GST and other charges: ₹{totalCharge.toFixed(2)}</strong>{" "}
                    (expands into <code className="text-indigo-600 font-mono">Platform fee: ₹{platformFee.toFixed(2)}</code> +{" "}
                    <code className="text-indigo-600 font-mono">GST ({gstPercentage}%): ₹{gstAmount.toFixed(2)}</code>)
                  </span>
                </div>
              </div>

              {/* Additional Finishing Services */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Additional & Finishing Services (Customer Add-ons)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddCustom((p) => !p)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
                  >
                    {showAddCustom ? "− Hide Add Form" : "+ Add New Custom Service"}
                  </button>
                </div>

                {showAddCustom && (
                  <form
                    onSubmit={handleAddCustomService}
                    className="glass-bento rounded-3xl p-5 mb-4 glow-sm border border-indigo-200/80 space-y-3 animate-fade-in-up"
                  >
                    <div className="font-semibold text-xs text-slate-900">
                      Create Custom Service Offering
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Service Title
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Spiral Binding"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Category
                        </label>
                        <select
                          value={newServiceCategory}
                          onChange={(e) => setNewServiceCategory(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="finishing">Finishing / Post-Press</option>
                          <option value="print">Speciality Print / Paper</option>
                          <option value="addon">Packaging / Add-on</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Price (₹)
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(Math.max(0, Number(e.target.value)))}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Unit Model
                        </label>
                        <select
                          value={newServiceUnit}
                          onChange={(e) => setNewServiceUnit(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="per_copy">Per Copy / Document</option>
                          <option value="per_page">Per Page</option>
                          <option value="flat">Flat Fee</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddCustom(false)}
                        className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800"
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

                <div className="glass-bento rounded-3xl overflow-hidden glow-sm border border-slate-200/80">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60 text-[11px]">
                        <th className="py-3 px-4 font-semibold">Service Name</th>
                        <th className="py-3 px-4 font-semibold">Category</th>
                        <th className="py-3 px-4 font-semibold">Price (₹)</th>
                        <th className="py-3 px-4 font-semibold">Billing Unit</th>
                        <th className="py-3 px-4 font-semibold">Status / Toggle</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {servicesList
                        .filter((s) => !s.isCore)
                        .map((item) => (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50/50 transition ${
                              !item.enabled ? "opacity-60" : ""
                            }`}
                          >
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.price}
                                  onChange={(e) =>
                                    handleUpdateServicePrice(item.id, Number(e.target.value))
                                  }
                                  className="w-20 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-xs font-semibold font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 capitalize">
                              {item.unit.replace("_", " ")}
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => handleToggleService(item.id)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1.5 ${
                                  item.enabled
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    item.enabled ? "bg-emerald-500" : "bg-slate-400"
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
                                  className="text-rose-500 hover:text-rose-700 text-[11px] font-semibold"
                                >
                                  Delete
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">Preset</span>
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

          {/* TAB 4: QR & STANDEE */}
          {activeTab === "qr" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
              {/* Standee Preview */}
              <div className="glass-bento rounded-3xl p-6 text-center border border-slate-200/80">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                  Physical Counter Standee Preview
                </div>

                <div className="bg-white rounded-2xl p-6 text-[#09090b] shadow-xl mx-auto max-w-sm border border-slate-200/60">
                  <div className="flex justify-center mb-2">
                    <img
                      src="/logo.png"
                      alt="Printap"
                      className="w-8 h-8 rounded-lg object-cover shadow-sm border border-slate-200"
                    />
                  </div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">
                    PRINTAP SELF-SERVICE COUNTER
                  </div>
                  <h2 className="text-xl font-bold tracking-tight mb-1 text-slate-900">{shop.name}</h2>
                  <p className="text-[11px] text-slate-500 mb-4">Scan with phone camera to beam files</p>

                  <div ref={qrCanvasRef} className="inline-block p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                    <QRCodeCanvas value={customerUrl} size={180} level="H" />
                  </div>

                  <div ref={qrSvgRef} className="hidden">
                    <QRCodeSVG value={customerUrl} size={1024} level="H" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-100 p-2.5 rounded-xl text-center text-[10px] font-semibold mb-3 text-slate-700">
                    <div>1. Scan</div>
                    <div className="border-x border-slate-300">2. Select PDF</div>
                    <div>3. Collect</div>
                  </div>

                  <div className="text-[10px] font-mono text-emerald-600 font-bold">
                    UPI: {shop.upi_vpa}
                  </div>
                </div>
              </div>

              {/* Download Buttons & Advice */}
              <div className="space-y-4">
                <div className="glass-bento rounded-3xl p-6 border border-slate-200/80">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">
                    Download Counter Display Assets
                  </h3>
                  <p className="text-xs text-slate-500 mb-6">
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
                        className="glass py-2.5 rounded-xl font-semibold text-xs hover:bg-white text-slate-700 transition border border-slate-200"
                      >
                        Save Square PNG (1024px)
                      </button>
                      <button
                        onClick={downloadRawQrSvg}
                        className="glass py-2.5 rounded-xl font-semibold text-xs hover:bg-white text-slate-700 transition border border-slate-200"
                      >
                        Save Vector SVG
                      </button>
                    </div>
                  </div>
                </div>

                <div className="glass-bento rounded-3xl p-5 text-xs space-y-2 text-slate-500 border border-slate-200/80">
                  <div className="font-semibold text-slate-800">Display Recommendations:</div>
                  <p>• Acrylic Stand: A5 or 5×7" clear vertical acrylic L-stand.</p>
                  <p>• Paper: 250+ GSM cardstock for sharp QR scanning under overhead lights.</p>
                  <p>• Counter Position: Directly facing the customer waiting line.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PRINTERS */}
          {activeTab === "printers" && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="glass-bento rounded-3xl p-6 border border-slate-200/80">
                <h2 className="text-sm font-bold text-slate-900 mb-4">
                  Add / Assign Hardware Printer
                </h2>
                <form onSubmit={handleAddPrinter} className="flex gap-3 flex-wrap items-center">
                  <input
                    type="text"
                    placeholder="Printer name as shown in Windows (e.g. HP LaserJet 1020)"
                    value={newPrinterName}
                    onChange={(e) => setNewPrinterName(e.target.value)}
                    className="flex-1 min-w-[260px] px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newPrinterRole}
                    onChange={(e) => setNewPrinterRole(e.target.value as any)}
                    className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
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

              <div className="glass-bento rounded-3xl p-6 border border-slate-200/80">
                <h2 className="text-sm font-bold text-slate-900 mb-4">
                  Configured Hardware Printers ({printers.length})
                </h2>

                {printers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No printer assignments configured. Add a printer above or let the desktop app auto-detect.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {printers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex-wrap gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {p.printer_name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold border border-indigo-200/50">
                              Printer #{p.printer_number || 1}
                            </span>
                            {p.is_default && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-medium">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                            Role: {p.role}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePrinter(p)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                              p.is_active
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {p.is_active ? "● Online" : "○ Disabled"}
                          </button>
                          <button
                            onClick={() => handleDeletePrinter(p.id)}
                            className="px-2.5 py-1 rounded-lg text-xs text-rose-500 hover:bg-rose-50 transition"
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

          {/* TAB 6: PROFILE */}
          {activeTab === "profile" && (
            <div className="glass-bento rounded-3xl p-6 space-y-4 max-w-2xl animate-fade-in-up border border-slate-200/80">
              <h2 className="text-sm font-bold text-slate-900 mb-4">
                Shop Registration & Terminal Metadata
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Shop Name</span>
                  <span className="font-semibold text-slate-900">{shop.name}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Dedicated Subdomain</span>
                  <span className="font-mono text-indigo-600 font-semibold">{shop.slug || shop.id}.{ROOT_DOMAIN}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Settlement UPI</span>
                  <span className="font-mono text-slate-900 font-semibold">{shop.upi_vpa}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Terminal UUID</span>
                  <span className="font-mono text-slate-400 text-[10px]">{shop.id}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Account Status</span>
                  <span className="text-emerald-600 font-bold uppercase">{shop.status}</span>
                </div>

                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Created Date</span>
                  <span className="text-slate-500">{new Date(shop.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {unsavedModal?.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
          onClick={handleCancelNavigation}
        >
          <div
            className="w-full max-w-md p-6 rounded-3xl glass-bento glow-lg border border-slate-200/80 bg-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">Unsaved Changes</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You have unsaved changes in <strong className="text-slate-900">Services & Rates</strong>. Would you like to save your changes before leaving this section?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelNavigation}
                disabled={isSavingServices}
                className="px-4 py-2 rounded-xl text-xs font-semibold glass hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscardAndContinue}
                disabled={isSavingServices}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveAndContinue}
                disabled={isSavingServices}
                className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md shadow-slate-900/10"
              >
                {isSavingServices ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
