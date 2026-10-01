"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getSupabase,
  getCustomerPrintUrl,
  getShopCustomerUrl,
  ROOT_DOMAIN,
  SHOP_ADMIN_URL,
  sanitizeSubdomain,
  type ShopInfo,
} from "@printap/shared";

interface ExtendedShop extends ShopInfo {
  printCount?: number;
}

interface GlobalPrintEvent {
  id: string;
  shop_id: string;
  session_id: string;
  fee_amount: number;
  created_at: string;
  shop_name?: string;
  shop_slug?: string;
}

export default function PlatformAdminPage() {
  const [shops, setShops] = useState<ExtendedShop[]>([]);
  const [events, setEvents] = useState<GlobalPrintEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"shops" | "events" | "pricing" | "health">("shops");

  // Global Platform Fee & GST State (stored in database)
  const [globalPlatformFee, setGlobalPlatformFee] = useState<number>(0.82);
  const [globalGstPercentage, setGlobalGstPercentage] = useState<number>(18);
  const [globalGstAmount, setGlobalGstAmount] = useState<number>(0.18);
  const [globalTotalCharge, setGlobalTotalCharge] = useState<number>(1.00);
  const [isSavingGlobalPricing, setIsSavingGlobalPricing] = useState(false);
  const [globalPricingMsg, setGlobalPricingMsg] = useState("");

  const handleGlobalFeeChange = (val: number) => {
    const fee = Math.max(0, Number(val) || 0);
    setGlobalPlatformFee(fee);
    const gst = Math.round(fee * (globalGstPercentage / 100) * 100) / 100;
    setGlobalGstAmount(gst);
    setGlobalTotalCharge(Math.round((fee + gst) * 100) / 100);
  };

  const handleGlobalGstChange = (val: number) => {
    const pct = Math.max(0, Math.min(100, Number(val) || 0));
    setGlobalGstPercentage(pct);
    const gst = Math.round(globalPlatformFee * (pct / 100) * 100) / 100;
    setGlobalGstAmount(gst);
    setGlobalTotalCharge(Math.round((globalPlatformFee + gst) * 100) / 100);
  };

  // Create Shop Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newUpi, setNewUpi] = useState("");
  const [createError, setCreateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Shop Modal
  const [editingShop, setEditingShop] = useState<ExtendedShop | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editUpi, setEditUpi] = useState("");
  const [editPlatformFee, setEditPlatformFee] = useState<number>(0.82);
  const [editGstPercentage, setEditGstPercentage] = useState<number>(18);
  const [editGstAmount, setEditGstAmount] = useState<number>(0.18);
  const [editTotalCharge, setEditTotalCharge] = useState<number>(1.00);
  const [editError, setEditError] = useState("");

  const handleEditFeeChange = (val: number) => {
    const fee = Math.max(0, Number(val) || 0);
    setEditPlatformFee(fee);
    const gst = Math.round(fee * (editGstPercentage / 100) * 100) / 100;
    setEditGstAmount(gst);
    setEditTotalCharge(Math.round((fee + gst) * 100) / 100);
  };

  const handleEditGstChange = (val: number) => {
    const pct = Math.max(0, Math.min(100, Number(val) || 0));
    setEditGstPercentage(pct);
    const gst = Math.round(editPlatformFee * (pct / 100) * 100) / 100;
    setEditGstAmount(gst);
    setEditTotalCharge(Math.round((editPlatformFee + gst) * 100) / 100);
  };

  const loadPlatformData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      // Fetch global platform settings
      try {
        const { data: psData } = await supabase
          .from("platform_settings")
          .select("*")
          .eq("id", "global")
          .maybeSingle();

        if (psData) {
          const pf = Number(psData.platform_fee) || 0.82;
          const gp = Number(psData.gst_percentage) || 18;
          const ga = psData.gst_amount !== undefined ? Number(psData.gst_amount) : Math.round(pf * (gp / 100) * 100) / 100;
          const tc = psData.total_charge !== undefined ? Number(psData.total_charge) : Math.round((pf + ga) * 100) / 100;
          setGlobalPlatformFee(pf);
          setGlobalGstPercentage(gp);
          setGlobalGstAmount(ga);
          setGlobalTotalCharge(tc);
        }
      } catch (psErr) {
        console.warn("Could not load platform_settings:", psErr);
      }

      // Fetch all shops
      const { data: shopsData, error: shopsErr } = await supabase
        .from("shops")
        .select("*")
        .order("created_at", { ascending: false });

      if (shopsErr) {
        console.error("Failed to load shops:", shopsErr);
      }

      // Fetch recent global print events
      const { data: eventsData, error: eventsErr } = await supabase
        .from("print_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (eventsErr) {
        console.error("Failed to load print events:", eventsErr);
      }

      const rawShops = (shopsData || []) as ExtendedShop[];
      const rawEvents = (eventsData || []) as GlobalPrintEvent[];

      // Map event shops for readability
      const shopMap = new Map<string, ExtendedShop>();
      rawShops.forEach((s) => shopMap.set(s.id, s));

      const enrichedEvents = rawEvents.map((ev) => {
        const found = shopMap.get(ev.shop_id);
        return {
          ...ev,
          shop_name: found?.name || "Unknown Shop",
          shop_slug: found?.slug || ev.shop_id.slice(0, 8),
        };
      });

      // Calculate prints per shop
      const printCounts: Record<string, number> = {};
      rawEvents.forEach((ev) => {
        printCounts[ev.shop_id] = (printCounts[ev.shop_id] || 0) + 1;
      });

      const enrichedShops = rawShops.map((s) => ({
        ...s,
        printCount: printCounts[s.id] || 0,
      }));

      setShops(enrichedShops);
      setEvents(enrichedEvents);
    } catch (err) {
      console.error("Platform data error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatformData();
  }, [loadPlatformData]);

  // Kill-Switch: Toggle Shop Status
  const handleToggleStatus = async (shop: ExtendedShop) => {
    const newStatus = shop.status === "active" ? "suspended" : "active";
    const confirmMsg =
      newStatus === "suspended"
        ? `Are you sure you want to SUSPEND "${shop.name}"? Customer print access will be immediately blocked.`
        : `Activate "${shop.name}"? Customer print page will resume accepting jobs.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("shops")
        .update({ status: newStatus })
        .eq("id", shop.id);

      if (error) throw error;
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, status: newStatus } : s))
      );
    } catch (err) {
      alert(`Failed to update status: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Auto slug generator when creating shop
  const handleNameChange = (val: string) => {
    setNewName(val);
    if (!newSlug || newSlug === sanitizeSubdomain(newName)) {
      setNewSlug(sanitizeSubdomain(val));
    }
  };

  // Submit Create Shop
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newName.trim() || !newUpi.trim()) {
      setCreateError("Name and UPI VPA are required.");
      return;
    }

    const cleanSlug = sanitizeSubdomain(newSlug || newName);
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();

      // Check if slug taken
      const { data: existing } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", cleanSlug)
        .maybeSingle();

      if (existing) {
        setCreateError(`Subdomain slug "${cleanSlug}.${ROOT_DOMAIN}" is already taken.`);
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from("shops")
        .insert({
          name: newName.trim(),
          slug: cleanSlug,
          upi_vpa: newUpi.trim(),
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      setShowCreateModal(false);
      setNewName("");
      setNewSlug("");
      setNewUpi("");
      loadPlatformData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (shop: ExtendedShop) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditSlug(shop.slug || sanitizeSubdomain(shop.name));
    setEditUpi(shop.upi_vpa);
    const pf = shop.platform_fee !== undefined && shop.platform_fee !== null ? Number(shop.platform_fee) : globalPlatformFee;
    const gp = shop.gst_percentage !== undefined && shop.gst_percentage !== null ? Number(shop.gst_percentage) : globalGstPercentage;
    const ga = shop.gst_amount !== undefined && shop.gst_amount !== null ? Number(shop.gst_amount) : Math.round(pf * (gp / 100) * 100) / 100;
    const tc = shop.total_charge !== undefined && shop.total_charge !== null ? Number(shop.total_charge) : Math.round((pf + ga) * 100) / 100;
    setEditPlatformFee(pf);
    setEditGstPercentage(gp);
    setEditGstAmount(ga);
    setEditTotalCharge(tc);
    setEditError("");
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    setEditError("");

    const cleanSlug = sanitizeSubdomain(editSlug);

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("shops")
        .update({
          name: editName.trim(),
          slug: cleanSlug,
          upi_vpa: editUpi.trim(),
          platform_fee: editPlatformFee,
          gst_percentage: editGstPercentage,
          gst_amount: editGstAmount,
          total_charge: editTotalCharge,
        })
        .eq("id", editingShop.id);

      if (error) throw error;

      setEditingShop(null);
      loadPlatformData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    }
  };

  // Save Global Platform Fee & GST
  const handleSaveGlobalPricing = async (applyToAllShops = false) => {
    setIsSavingGlobalPricing(true);
    setGlobalPricingMsg("");
    try {
      const supabase = getSupabase();
      const { error: psErr } = await supabase.from("platform_settings").upsert({
        id: "global",
        platform_fee: globalPlatformFee,
        gst_percentage: globalGstPercentage,
        gst_amount: globalGstAmount,
        total_charge: globalTotalCharge,
        updated_at: new Date().toISOString(),
      });
      if (psErr) throw psErr;

      if (applyToAllShops) {
        await supabase
          .from("shops")
          .update({
            platform_fee: globalPlatformFee,
            gst_percentage: globalGstPercentage,
            gst_amount: globalGstAmount,
            total_charge: globalTotalCharge,
          })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }

      setGlobalPricingMsg(
        applyToAllShops
          ? "Global fee & GST saved to database and propagated to all shops!"
          : "Global fee & GST settings saved to database successfully!"
      );
      setTimeout(() => setGlobalPricingMsg(""), 4000);
      loadPlatformData();
    } catch (err) {
      alert("Failed to save global pricing: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingGlobalPricing(false);
    }
  };

  // Filtered shops
  const filteredShops = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.slug && s.slug.toLowerCase().includes(search.toLowerCase())) ||
      s.upi_vpa.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = shops.filter((s) => s.status === "active").length;
  const suspendedCount = shops.filter((s) => s.status === "suspended").length;
  const totalRevenue = events.reduce((acc, ev) => acc + (Number(ev.fee_amount) || 1), 0);

  return (
    <div className="min-h-screen cyber-bg text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="px-4 sm:px-6 py-5 max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {/* ─── TOP PLATFORM HUD HEADER ─── */}
        <header className="cyber-card p-4 sm:p-5 mb-6 cyber-hud-corner flex items-center justify-between flex-wrap gap-4 border-cyan-500/20">
          <div className="cyber-scanline" />

          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Printap"
                className="w-11 h-11 rounded-xl object-cover shadow-[0_0_15px_rgba(0,240,255,0.3)] border border-cyan-400/40"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-[#090d18] animate-radar-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-black tracking-tight text-white">
                  Printap Platform Console
                </h1>
                <span className="cyber-chip-cyan px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
                  admin.{ROOT_DOMAIN}
                </span>
                <span className="cyber-chip-emerald px-2 py-0.5 rounded-full text-[10px] font-mono">
                  NETWORK_READY
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Global Infrastructure, Subdomain Router & Kill-Switch Controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowCreateModal(true)}
              className="cyber-btn-cyan px-4 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5"
            >
              <span>+</span>
              <span>REGISTER NEW SHOP</span>
            </button>

            <button
              onClick={loadPlatformData}
              className="cyber-btn-secondary px-3.5 py-2.5 rounded-xl text-xs font-mono font-semibold"
              title="Refresh network telemetry"
            >
              ↻ REFRESH
            </button>
          </div>
        </header>

        {/* ─── KPI BENTO STATS MATRIX ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="cyber-card p-5 border-slate-800 hover:border-cyan-500/30 flex flex-col justify-between">
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1">
              // TOTAL_REGISTERED_NODES
            </div>
            <div className="text-3xl font-black font-mono text-white my-1">
              {shops.length}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              Active physical shop terminals
            </div>
          </div>

          <div className="cyber-card p-5 border-slate-800 hover:border-emerald-500/30 flex flex-col justify-between">
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1">
              // ACTIVE_COUNTERS
            </div>
            <div className="text-3xl font-black font-mono cyber-text-emerald my-1">
              {activeCount}
            </div>
            <div className="text-[10px] font-mono text-emerald-400/80">
              Accepting customer prints
            </div>
          </div>

          <div className="cyber-card p-5 border-slate-800 hover:border-amber-500/30 flex flex-col justify-between">
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1">
              // SUSPENDED_COUNTERS
            </div>
            <div className="text-3xl font-black font-mono cyber-text-amber my-1">
              {suspendedCount}
            </div>
            <div className="text-[10px] font-mono text-amber-400/80">
              Kill-switched (inaccessible)
            </div>
          </div>

          <div className="cyber-card p-5 border-slate-800 hover:border-cyan-500/30 flex flex-col justify-between">
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1">
              // NETWORK_PRINTS_VOLUME
            </div>
            <div className="text-3xl font-black font-mono cyber-text-cyan my-1">
              {events.length}
            </div>
            <div className="text-[10px] font-mono text-cyan-300">
              Platform Fee: ₹{totalRevenue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* ─── CYBER BENTO TABS NAVIGATION ─── */}
        <nav className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          {[
            { key: "shops", label: `// 01. SHOPS_DIRECTORY (${shops.length})` },
            { key: "events", label: `// 02. GLOBAL_LEDGER (${events.length})` },
            { key: "pricing", label: `// 03. PLATFORM_TAX (₹${globalTotalCharge.toFixed(2)})` },
            { key: "health", label: `// 04. MESH_ROUTING_HEALTH` },
          ].map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? "cyber-card cyber-hud-corner text-cyan-300 border-cyan-400/50 shadow-[0_0_20px_rgba(0,240,255,0.2)] bg-cyan-950/40"
                    : "cyber-card text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700 bg-slate-900/40"
                }`}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 1: SHOPS DIRECTORY & KILL-SWITCH CONTROLS ───────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "shops" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <input
                type="text"
                placeholder="Search shop by name, slug, UPI VPA, or UUID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md w-full px-4 py-2.5 cyber-input text-xs font-mono text-white placeholder-slate-500"
              />
              <span className="text-xs font-mono text-slate-400">
                Displaying {filteredShops.length} of {shops.length} network nodes
              </span>
            </div>

            <div className="cyber-card overflow-hidden border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] bg-slate-950/40">
                      <th className="py-3.5 px-4">Shop Node</th>
                      <th className="py-3.5 px-4">Subdomain</th>
                      <th className="py-3.5 px-4">Settlement UPI</th>
                      <th className="py-3.5 px-4">Kill-Switch State</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredShops.map((s) => {
                      const shopUrl = getShopCustomerUrl(s);
                      const isSuspended = s.status === "suspended";

                      return (
                        <tr key={s.id} className="hover:bg-cyan-500/5 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white">{s.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{s.id}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <a
                              href={shopUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-cyan-300 hover:text-cyan-200 hover:underline flex items-center gap-1 font-bold"
                            >
                              <span>{s.slug || s.id.slice(0, 8)}.{ROOT_DOMAIN}</span>
                              <span className="text-[10px]">↗</span>
                            </a>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {s.upi_vpa}
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleStatus(s)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                                isSuspended
                                  ? "cyber-chip-rose hover:bg-rose-500/20"
                                  : "cyber-chip-emerald hover:bg-emerald-500/20"
                              }`}
                              title="Click to toggle kill-switch"
                            >
                              {isSuspended ? "⛔ SUSPENDED (ACTIVATE)" : "● ACTIVE (SUSPEND)"}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(s)}
                                className="px-2.5 py-1 rounded-lg text-xs font-mono cyber-btn-secondary"
                              >
                                EDIT
                              </button>
                              <a
                                href={shopUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-lg text-xs font-mono cyber-btn-cyan"
                              >
                                VISIT ↗
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 2: GLOBAL PRINT LEDGER STREAM ───────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "events" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="cyber-card p-6 border-slate-800">
              <div className="flex items-center gap-2 mb-4 font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                <span>// GLOBAL_NETWORK_TRANSMISSION_STREAM</span>
                <span className="cyber-chip-cyan px-2 py-0.5 rounded text-[10px]">
                  ALL SHOPS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] bg-slate-950/40">
                      <th className="pb-3 px-3">Session Hash</th>
                      <th className="pb-3 px-3">Shop Node</th>
                      <th className="pb-3 px-3">Endpoint</th>
                      <th className="pb-3 px-3">Convenience Fee</th>
                      <th className="pb-3 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-cyan-500/5 transition">
                        <td className="py-3 px-3 text-cyan-300 font-bold">
                          #{ev.session_id.slice(0, 10)}
                        </td>
                        <td className="py-3 px-3 text-white font-bold">
                          {ev.shop_name}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {ev.shop_slug}.{ROOT_DOMAIN}
                        </td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">
                          ₹{Number(ev.fee_amount || 1).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(ev.created_at).toLocaleString()}
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
        {/* ─── TAB 3: GLOBAL PLATFORM FEE & GST SETTINGS ───────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "pricing" && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="cyber-card p-6 cyber-hud-corner border-cyan-500/30">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400 uppercase tracking-widest mb-1">
                    // GLOBAL_CONVENIENCE_FEE_AND_GST_CONFIG
                  </div>
                  <h3 className="text-lg font-black text-white">
                    Platform Revenue & Tax Compliance Engine
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xl mt-1">
                    Configure the platform base convenience fee and GST rate applied to every print job across all shops. Values are stored in `platform_settings` and synchronized network-wide.
                  </p>
                </div>

                {globalPricingMsg && (
                  <span className="cyber-chip-emerald px-3 py-1 rounded-xl text-xs font-mono font-bold animate-fade-in-up">
                    ✓ {globalPricingMsg}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <label className="block text-[11px] font-mono font-bold text-slate-300 uppercase mb-2">
                    Base Platform Fee (₹)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={globalPlatformFee}
                      onChange={(e) => handleGlobalFeeChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 cyber-input text-sm font-mono font-bold text-cyan-300"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">
                    Net platform fee before tax
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <label className="block text-[11px] font-mono font-bold text-slate-300 uppercase mb-2">
                    GST Rate (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={globalGstPercentage}
                      onChange={(e) => handleGlobalGstChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 cyber-input text-sm font-mono font-bold text-center text-white"
                    />
                    <span className="font-mono font-bold text-slate-400">%</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1.5 block">
                    Statutory GST rate
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col justify-between">
                  <div className="text-[10px] font-mono font-bold text-purple-300 uppercase tracking-widest">
                    Auto-Calculated GST
                  </div>
                  <div className="text-2xl font-black font-mono cyber-text-purple my-1">
                    ₹{globalGstAmount.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {globalGstPercentage}% on ₹{globalPlatformFee.toFixed(2)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col justify-between">
                  <div className="text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-widest">
                    Customer Surcharge
                  </div>
                  <div className="text-2xl font-black font-mono cyber-text-emerald my-1">
                    ₹{globalTotalCharge.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400/80">
                    ₹{globalPlatformFee.toFixed(2)} fee + ₹{globalGstAmount.toFixed(2)} tax
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-slate-800">
                <div className="text-xs font-mono text-slate-400">
                  Customer surcharge: <strong className="text-emerald-300">₹{globalTotalCharge.toFixed(2)}</strong> (₹{globalPlatformFee.toFixed(2)} + ₹{globalGstAmount.toFixed(2)} GST)
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveGlobalPricing(false)}
                    disabled={isSavingGlobalPricing}
                    className="cyber-btn-cyan px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    {isSavingGlobalPricing ? "SAVING..." : "SAVE GLOBAL SETTINGS"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveGlobalPricing(true)}
                    disabled={isSavingGlobalPricing}
                    className="cyber-btn-secondary px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase"
                    title="Update platform_settings and cascade to all existing shops"
                  >
                    SAVE & APPLY TO ALL SHOPS
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ─── TAB 4: ROUTING ARCHITECTURE & SYSTEM HEALTH ─────────────── */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "health" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
            <div className="cyber-card p-6 cyber-hud-corner border-slate-800">
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">
                // SUBDOMAIN_ROUTER_TOPOLOGY
              </div>
              <h3 className="text-base font-bold text-white mb-4">
                Subdomain Mesh Topology ({ROOT_DOMAIN})
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Landing & Marketing:</span>
                  <span className="text-cyan-300 font-bold">www.{ROOT_DOMAIN}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Shop Owner Admin Portal:</span>
                  <span className="text-cyan-300 font-bold">shop.{ROOT_DOMAIN}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Platform Admin Console:</span>
                  <span className="text-cyan-300 font-bold">admin.{ROOT_DOMAIN}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Dynamic Customer Counters:</span>
                  <span className="text-emerald-400 font-bold">*.{ROOT_DOMAIN}</span>
                </div>
              </div>
            </div>

            <div className="cyber-card p-6 cyber-hud-corner border-slate-800">
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-1">
                // TELEMETRY_HEALTH_MONITOR
              </div>
              <h3 className="text-base font-bold text-white mb-4">
                Platform Services Live Health
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Supabase DB & Auth:</span>
                  <span className="text-emerald-400 font-bold">● CONNECTED</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Realtime WebRTC Signaling:</span>
                  <span className="text-emerald-400 font-bold">● OPERATIONAL</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Peer-to-Peer RAM Channel:</span>
                  <span className="text-emerald-400 font-bold">● 100% ZERO STORAGE</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400">Localhost Strict Ban:</span>
                  <span className="text-emerald-400 font-bold">✓ ENFORCED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── CREATE SHOP MODAL ─── */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="cyber-card p-7 max-w-md w-full border-cyan-500/40 cyber-hud-corner shadow-[0_0_50px_rgba(0,240,255,0.25)] space-y-4 animate-fade-in-up">
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                [REGISTER_NEW_SHOP_NODE]
              </div>
              <h2 className="text-lg font-black text-white">
                Deploy Shop Subdomain
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Provisions instant WebRTC signaling and a dedicated subdomain under {ROOT_DOMAIN}.
              </p>

              <form onSubmit={handleCreateShop} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    SHOP NAME:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Xerox & Printing"
                    value={newName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-4 py-2.5 cyber-input text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    SUBDOMAIN SLUG:
                  </label>
                  <div className="flex items-center rounded-xl cyber-input px-3">
                    <input
                      type="text"
                      placeholder="rahul-xerox"
                      value={newSlug}
                      onChange={(e) => setNewSlug(sanitizeSubdomain(e.target.value))}
                      className="flex-1 py-2.5 bg-transparent text-xs text-cyan-300 font-mono outline-none"
                      required
                    />
                    <span className="text-xs text-slate-500 font-mono">.{ROOT_DOMAIN}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    SETTLEMENT UPI VPA:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. rahul@okaxis or 9876543210@paytm"
                    value={newUpi}
                    onChange={(e) => setNewUpi(e.target.value)}
                    className="w-full px-4 py-2.5 cyber-input text-xs text-emerald-300"
                    required
                  />
                </div>

                {createError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                    {createError}
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="cyber-btn-cyan px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
                  >
                    {isSubmitting ? "DEPLOYING..." : "DEPLOY SUBDOMAIN"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── EDIT SHOP MODAL ─── */}
        {editingShop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="cyber-card p-7 max-w-md w-full border-cyan-500/40 cyber-hud-corner shadow-[0_0_50px_rgba(0,240,255,0.25)] space-y-4 animate-fade-in-up">
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                [UPDATE_SHOP_NODE_CONFIG]
              </div>
              <h2 className="text-lg font-black text-white">
                Edit Shop Node: {editingShop.name}
              </h2>
              <p className="text-xs font-mono text-slate-400">
                UUID: {editingShop.id}
              </p>

              <form onSubmit={handleSaveEdit} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    SHOP NAME:
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 cyber-input text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    SUBDOMAIN SLUG:
                  </label>
                  <div className="flex items-center rounded-xl cyber-input px-3">
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(sanitizeSubdomain(e.target.value))}
                      className="flex-1 py-2.5 bg-transparent text-xs text-cyan-300 font-mono outline-none"
                      required
                    />
                    <span className="text-xs text-slate-500 font-mono">.{ROOT_DOMAIN}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    SETTLEMENT UPI VPA:
                  </label>
                  <input
                    type="text"
                    value={editUpi}
                    onChange={(e) => setEditUpi(e.target.value)}
                    className="w-full px-4 py-2.5 cyber-input text-xs text-emerald-300"
                    required
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>SURCHARGE & TAX</span>
                    <span className="text-emerald-400">Total: ₹{editTotalCharge.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        BASE FEE (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPlatformFee}
                        onChange={(e) => handleEditFeeChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 cyber-input text-xs font-bold text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">
                        GST (%)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={editGstPercentage}
                        onChange={(e) => handleEditGstChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 cyber-input text-xs font-bold text-center text-white"
                      />
                    </div>
                  </div>
                </div>

                {editError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                    {editError}
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingShop(null)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="cyber-btn-cyan px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
                  >
                    COMMIT EDITS
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
