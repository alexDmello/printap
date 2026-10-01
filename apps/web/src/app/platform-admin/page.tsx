"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getSupabase, ROOT_DOMAIN } from "@printap/shared";
import type { ExtendedShop, GlobalPrintEvent, NavigationTab } from "./types";
import { Sidebar } from "./components/Sidebar";
import { OverviewView } from "./components/OverviewView";
import { AnalyticsView } from "./components/AnalyticsView";
import { ShopsView } from "./components/ShopsView";
import { LedgerView } from "./components/LedgerView";
import { PricingView } from "./components/PricingView";
import { HealthView } from "./components/HealthView";
import { CreateShopModal } from "./components/CreateShopModal";
import { EditShopModal } from "./components/EditShopModal";
import { IconMenu, IconRefresh, IconPlus } from "./components/Icons";

export default function PlatformAdminPage() {
  const [shops, setShops] = useState<ExtendedShop[]>([]);
  const [events, setEvents] = useState<GlobalPrintEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavigationTab>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Global Platform Fee & GST State (stored in database)
  const [globalPlatformFee, setGlobalPlatformFee] = useState<number>(0.82);
  const [globalGstPercentage, setGlobalGstPercentage] = useState<number>(18);
  const [globalGstAmount, setGlobalGstAmount] = useState<number>(0.18);
  const [globalTotalCharge, setGlobalTotalCharge] = useState<number>(1.0);
  const [isSavingGlobalPricing, setIsSavingGlobalPricing] = useState(false);
  const [globalPricingMsg, setGlobalPricingMsg] = useState("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingShop, setEditingShop] = useState<ExtendedShop | null>(null);

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

  const loadPlatformData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      // 1. Fetch global platform settings
      try {
        const { data: psData } = await supabase
          .from("platform_settings")
          .select("*")
          .eq("id", "global")
          .maybeSingle();

        if (psData) {
          const pf = Number(psData.platform_fee) || 0.82;
          const gp = Number(psData.gst_percentage) || 18;
          const ga =
            psData.gst_amount !== undefined
              ? Number(psData.gst_amount)
              : Math.round(pf * (gp / 100) * 100) / 100;
          const tc =
            psData.total_charge !== undefined
              ? Number(psData.total_charge)
              : Math.round((pf + ga) * 100) / 100;

          setGlobalPlatformFee(pf);
          setGlobalGstPercentage(gp);
          setGlobalGstAmount(ga);
          setGlobalTotalCharge(tc);
        }
      } catch (psErr) {
        console.warn("Could not load platform_settings:", psErr);
      }

      // 2. Fetch all shops
      const { data: shopsData, error: shopsErr } = await supabase
        .from("shops")
        .select("*")
        .order("created_at", { ascending: false });

      if (shopsErr) {
        console.error("Failed to load shops:", shopsErr);
      }

      // 3. Fetch recent global print events
      const { data: eventsData, error: eventsErr } = await supabase
        .from("print_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

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
          shop_name: found?.name || "Unknown Terminal",
          shop_slug: found?.slug || ev.shop_id.slice(0, 8),
        };
      });

      // Calculate prints & revenue per shop
      const printCounts: Record<string, number> = {};
      const revenueCounts: Record<string, number> = {};

      rawEvents.forEach((ev) => {
        printCounts[ev.shop_id] = (printCounts[ev.shop_id] || 0) + 1;
        revenueCounts[ev.shop_id] =
          (revenueCounts[ev.shop_id] || 0) + (Number(ev.fee_amount) || 0.82);
      });

      const enrichedShops = rawShops.map((s) => ({
        ...s,
        printCount: printCounts[s.id] || 0,
        revenueGenerated: revenueCounts[s.id] || 0,
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
        ? `Kill-switch "${shop.name}"?\nCustomer print access on ${shop.slug || shop.id}.${ROOT_DOMAIN} will be blocked immediately.`
        : `Reactivate "${shop.name}"?\nCustomer counter will resume accepting prints immediately.`;

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
          ? "Settings saved & propagated across all shops!"
          : "Global platform fee settings saved successfully!"
      );
      setTimeout(() => setGlobalPricingMsg(""), 4000);
      loadPlatformData();
    } catch (err) {
      alert("Failed to save global pricing: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingGlobalPricing(false);
    }
  };

  const activeCount = shops.filter((s) => s.status === "active").length;
  const suspendedCount = shops.filter((s) => s.status === "suspended").length;
  const totalRevenue = events.reduce(
    (acc, ev) => acc + (Number(ev.fee_amount) || globalPlatformFee),
    0
  );

  return (
    <div className="wabi-root text-zinc-900 flex min-h-screen">
      {/* White Left Sidebar Rail */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        shopsCount={shops.length}
        activeCount={activeCount}
        eventsCount={events.length}
        globalTotalCharge={globalTotalCharge}
        onOpenCreateModal={() => setShowCreateModal(true)}
        onRefresh={loadPlatformData}
        loading={loading}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:text-black border border-zinc-200"
            >
              <IconMenu size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-400">Console /</span>
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-black">
                  {activeTab === "overview" && "Bento Overview"}
                  {activeTab === "analytics" && "Analytics Suite"}
                  {activeTab === "shops" && "Shops Directory"}
                  {activeTab === "ledger" && "Print Ledger"}
                  {activeTab === "pricing" && "Fee & GST Engine"}
                  {activeTab === "health" && "System Topology"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Surcharge Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-mono">
              <span className="text-zinc-500">Active Surcharge:</span>
              <span className="text-black font-bold">
                ₹{globalTotalCharge.toFixed(2)}
              </span>
            </div>

            {/* Quick Refresh Button */}
            <button
              onClick={loadPlatformData}
              disabled={loading}
              className="p-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border border-zinc-200 text-xs transition flex items-center gap-1.5"
              title="Refresh network data"
            >
              <span className={loading ? "animate-spin" : ""}>
                <IconRefresh size={14} />
              </span>
              <span className="hidden md:inline text-xs">Sync</span>
            </button>

            {/* Quick Action: Register Shop */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="wabi-btn-primary px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-semibold"
            >
              <IconPlus size={13} />
              <span className="hidden sm:inline">New Shop</span>
            </button>
          </div>
        </header>

        {/* Dynamic Content Views */}
        <main className="p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto">
          {activeTab === "overview" && (
            <OverviewView
              shops={shops}
              events={events}
              activeCount={activeCount}
              suspendedCount={suspendedCount}
              totalRevenue={totalRevenue}
              globalPlatformFee={globalPlatformFee}
              globalGstAmount={globalGstAmount}
              globalTotalCharge={globalTotalCharge}
              setActiveTab={setActiveTab}
              onOpenCreateModal={() => setShowCreateModal(true)}
              onToggleStatus={handleToggleStatus}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsView
              shops={shops}
              events={events}
              globalPlatformFee={globalPlatformFee}
              globalGstPercentage={globalGstPercentage}
              globalGstAmount={globalGstAmount}
              globalTotalCharge={globalTotalCharge}
            />
          )}

          {activeTab === "shops" && (
            <ShopsView
              shops={shops}
              onOpenCreateModal={() => setShowCreateModal(true)}
              onOpenEditModal={(shop) => setEditingShop(shop)}
              onToggleStatus={handleToggleStatus}
              globalPlatformFee={globalPlatformFee}
            />
          )}

          {activeTab === "ledger" && (
            <LedgerView
              events={events}
              shops={shops}
              globalPlatformFee={globalPlatformFee}
            />
          )}

          {activeTab === "pricing" && (
            <PricingView
              globalPlatformFee={globalPlatformFee}
              globalGstPercentage={globalGstPercentage}
              globalGstAmount={globalGstAmount}
              globalTotalCharge={globalTotalCharge}
              handleGlobalFeeChange={handleGlobalFeeChange}
              handleGlobalGstChange={handleGlobalGstChange}
              handleSaveGlobalPricing={handleSaveGlobalPricing}
              isSavingGlobalPricing={isSavingGlobalPricing}
              globalPricingMsg={globalPricingMsg}
            />
          )}

          {activeTab === "health" && <HealthView />}
        </main>
      </div>

      {/* Floating Modals */}
      <CreateShopModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadPlatformData}
      />

      <EditShopModal
        shop={editingShop}
        onClose={() => setEditingShop(null)}
        onSuccess={loadPlatformData}
        globalPlatformFee={globalPlatformFee}
        globalGstPercentage={globalGstPercentage}
      />
    </div>
  );
}
