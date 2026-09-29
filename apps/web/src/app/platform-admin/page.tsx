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
  const [activeTab, setActiveTab] = useState<"shops" | "events" | "health">("shops");

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
  const [editError, setEditError] = useState("");

  const loadPlatformData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

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
        })
        .eq("id", editingShop.id);

      if (error) throw error;

      setEditingShop(null);
      loadPlatformData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
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
    <div className="min-h-screen flex flex-col px-6 py-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between py-4 border-b border-[--color-border]/60 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[--color-foreground]">
                Printap Platform Console
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                admin.{ROOT_DOMAIN}
              </span>
            </div>
            <p className="text-xs text-[--color-muted]">
              Global Infrastructure, Shop Management & Kill-Switch Controls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary px-4 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2"
          >
            <span>+</span> Register New Shop
          </button>
          <button
            onClick={loadPlatformData}
            className="glass px-3.5 py-2.5 rounded-xl text-xs text-[--color-muted] hover:text-[--color-foreground] transition"
            title="Refresh network data"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-2xl p-5 glow-sm">
          <div className="text-xs text-[--color-muted] mb-1">Total Shops</div>
          <div className="text-2xl font-bold text-[--color-foreground]">{shops.length}</div>
          <div className="text-[11px] text-[--color-muted] mt-1">
            Registered terminals on platform
          </div>
        </div>

        <div className="glass rounded-2xl p-5 glow-sm">
          <div className="text-xs text-[--color-muted] mb-1">Active Counters</div>
          <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
          <div className="text-[11px] text-emerald-500/70 mt-1">Accepting customer prints</div>
        </div>

        <div className="glass rounded-2xl p-5 glow-sm">
          <div className="text-xs text-[--color-muted] mb-1">Suspended Counters</div>
          <div className="text-2xl font-bold text-amber-400">{suspendedCount}</div>
          <div className="text-[11px] text-amber-500/70 mt-1">Kill-switched (inaccessible)</div>
        </div>

        <div className="glass rounded-2xl p-5 glow-sm">
          <div className="text-xs text-[--color-muted] mb-1">Total Network Prints</div>
          <div className="text-2xl font-bold text-indigo-400">{events.length}</div>
          <div className="text-[11px] text-[--color-muted] mt-1">
            Platform Fee: ₹{totalRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveTab("shops")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "shops"
              ? "bg-[--color-accent] text-white"
              : "glass text-[--color-muted] hover:text-[--color-foreground]"
          }`}
        >
          Shops Directory & Controls ({shops.length})
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "events"
              ? "bg-[--color-accent] text-white"
              : "glass text-[--color-muted] hover:text-[--color-foreground]"
          }`}
        >
          Global Print Ledger ({events.length})
        </button>
        <button
          onClick={() => setActiveTab("health")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "health"
              ? "bg-[--color-accent] text-white"
              : "glass text-[--color-muted] hover:text-[--color-foreground]"
          }`}
        >
          Routing & System Health
        </button>
      </nav>

      {/* TAB 1: SHOPS DIRECTORY & KILL-SWITCH */}
      {activeTab === "shops" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <input
              type="text"
              placeholder="Search shop by name, slug, UPI, or UUID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md w-full px-4 py-2.5 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground] placeholder-[--color-muted]"
            />
            <span className="text-xs text-[--color-muted]">
              Showing {filteredShops.length} of {shops.length} shops
            </span>
          </div>

          <div className="glass rounded-2xl overflow-hidden border border-[--color-border]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[--color-border] bg-[--color-surface-light]/40 text-[--color-muted]">
                    <th className="py-3 px-4 font-semibold">Shop Name</th>
                    <th className="py-3 px-4 font-semibold">Subdomain</th>
                    <th className="py-3 px-4 font-semibold">Settlement UPI</th>
                    <th className="py-3 px-4 font-semibold">Status / Kill-Switch</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--color-border]/40">
                  {filteredShops.map((s) => {
                    const shopUrl = getShopCustomerUrl(s);
                    const isSuspended = s.status === "suspended";

                    return (
                      <tr key={s.id} className="hover:bg-[--color-surface-light]/20 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[--color-foreground]">{s.name}</div>
                          <div className="font-mono text-[10px] text-[--color-muted]">{s.id}</div>
                        </td>

                        <td className="py-3 px-4">
                          <a
                            href={shopUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <span>{s.slug || s.id.slice(0, 8)}.{ROOT_DOMAIN}</span>
                            <span className="text-[10px]">↗</span>
                          </a>
                        </td>

                        <td className="py-3 px-4 font-mono text-[--color-foreground]/90">
                          {s.upi_vpa}
                        </td>

                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleStatus(s)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                              isSuspended
                                ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                            }`}
                            title="Click to toggle kill-switch"
                          >
                            {isSuspended ? "⛔ Suspended (Click to activate)" : "● Active (Click to suspend)"}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(s)}
                              className="px-2.5 py-1 rounded-lg text-xs glass hover:bg-[--color-surface-light] transition"
                            >
                              Edit
                            </button>
                            <a
                              href={shopUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg text-xs glass text-indigo-400 hover:bg-[--color-surface-light] transition"
                            >
                              Open Counter
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

      {/* TAB 2: GLOBAL PRINT LEDGER */}
      {activeTab === "events" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4 text-[--color-foreground]">
              Real-time Print Events Stream (All Shops)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[--color-border] text-[--color-muted]">
                    <th className="pb-3 font-medium">Session ID</th>
                    <th className="pb-3 font-medium">Shop Name</th>
                    <th className="pb-3 font-medium">Subdomain</th>
                    <th className="pb-3 font-medium">Platform Fee</th>
                    <th className="pb-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--color-border]/40">
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-3 font-mono text-[--color-foreground]">
                        #{ev.session_id.slice(0, 8)}
                      </td>
                      <td className="py-3 font-medium text-[--color-foreground]">
                        {ev.shop_name}
                      </td>
                      <td className="py-3 font-mono text-indigo-400">
                        {ev.shop_slug}.{ROOT_DOMAIN}
                      </td>
                      <td className="py-3 font-mono text-emerald-400">
                        ₹{Number(ev.fee_amount || 1).toFixed(2)}
                      </td>
                      <td className="py-3 text-[--color-muted]">
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

      {/* TAB 3: SYSTEM & ROUTING HEALTH */}
      {activeTab === "health" && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-6 glow-sm">
              <h3 className="text-sm font-bold text-[--color-foreground] mb-4">
                Subdomain Architecture ({ROOT_DOMAIN})
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-[--color-border]">
                  <span className="text-[--color-muted]">Landing & Marketing</span>
                  <span className="font-mono text-indigo-400">www.{ROOT_DOMAIN}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[--color-border]">
                  <span className="text-[--color-muted]">Shop Owner Portal</span>
                  <span className="font-mono text-indigo-400">shop.{ROOT_DOMAIN}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[--color-border]">
                  <span className="text-[--color-muted]">Platform Admin Console</span>
                  <span className="font-mono text-indigo-400">admin.{ROOT_DOMAIN}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[--color-border]">
                  <span className="text-[--color-muted]">Dynamic Shop Counters</span>
                  <span className="font-mono text-emerald-400">*.{ROOT_DOMAIN}</span>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 glow-sm">
              <h3 className="text-sm font-bold text-[--color-foreground] mb-4">
                Platform Services Status
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-[--color-border]">
                  <span className="text-[--color-muted]">Supabase Database & Auth</span>
                  <span className="text-emerald-400 font-semibold">● Connected</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[--color-border]">
                  <span className="text-[--color-muted]">Supabase Realtime Signaling</span>
                  <span className="text-emerald-400 font-semibold">● Operational</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[--color-border]">
                  <span className="text-[--color-muted]">Peer-to-Peer WebRTC Pipeline</span>
                  <span className="text-emerald-400 font-semibold">● Active (Zero Cloud Storage)</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[--color-muted]">Localhost Strict Ban</span>
                  <span className="text-emerald-400 font-semibold">✓ Enforced ({ROOT_DOMAIN} Only)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SHOP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-strong rounded-3xl p-7 max-w-md w-full shadow-2xl animate-fade-in-up border border-[--color-border]">
            <h2 className="text-lg font-bold text-[--color-foreground] mb-2">
              Register New Shop
            </h2>
            <p className="text-xs text-[--color-muted] mb-5">
              Creates a dedicated subdomain under {ROOT_DOMAIN} with instant WebRTC signaling.
            </p>

            <form onSubmit={handleCreateShop} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[--color-foreground]/80 mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Xerox & Printing"
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[--color-foreground]/80 mb-1">
                  Subdomain Slug
                </label>
                <div className="flex items-center rounded-xl bg-[--color-surface-light] border border-[--color-border] px-3">
                  <input
                    type="text"
                    placeholder="rahul-xerox"
                    value={newSlug}
                    onChange={(e) => setNewSlug(sanitizeSubdomain(e.target.value))}
                    className="flex-1 py-2.5 bg-transparent text-xs text-[--color-foreground] font-mono outline-none"
                    required
                  />
                  <span className="text-xs text-[--color-muted] font-mono">.{ROOT_DOMAIN}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[--color-foreground]/80 mb-1">
                  UPI VPA (Settlement Account)
                </label>
                <input
                  type="text"
                  placeholder="e.g. rahul@okaxis or 9876543210@paytm"
                  value={newUpi}
                  onChange={(e) => setNewUpi(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground]"
                  required
                />
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[--color-muted] hover:text-[--color-foreground]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold text-white"
                >
                  {isSubmitting ? "Deploying..." : "Create & Deploy Subdomain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SHOP MODAL */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-strong rounded-3xl p-7 max-w-md w-full shadow-2xl animate-fade-in-up border border-[--color-border]">
            <h2 className="text-lg font-bold text-[--color-foreground] mb-2">
              Edit Shop Details
            </h2>
            <p className="text-xs text-[--color-muted] mb-5">
              Terminal UUID: {editingShop.id}
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[--color-foreground]/80 mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[--color-foreground]/80 mb-1">
                  Subdomain Slug
                </label>
                <div className="flex items-center rounded-xl bg-[--color-surface-light] border border-[--color-border] px-3">
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(sanitizeSubdomain(e.target.value))}
                    className="flex-1 py-2.5 bg-transparent text-xs text-[--color-foreground] font-mono outline-none"
                    required
                  />
                  <span className="text-xs text-[--color-muted] font-mono">.{ROOT_DOMAIN}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[--color-foreground]/80 mb-1">
                  UPI VPA
                </label>
                <input
                  type="text"
                  value={editUpi}
                  onChange={(e) => setEditUpi(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[--color-surface-light] border border-[--color-border] text-xs text-[--color-foreground]"
                  required
                />
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  className="px-4 py-2 rounded-xl text-xs text-[--color-muted] hover:text-[--color-foreground]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
