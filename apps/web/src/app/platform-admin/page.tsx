"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getSupabase,
  DEFAULT_PLATFORM_SETTINGS,
} from "@printap/shared";
import { AdminSidebar, type AdminTab } from "./components/AdminSidebar";
import { AdminHeader } from "./components/AdminHeader";
import { BentoOverview, type ExtendedShop, type GlobalPrintEvent } from "./components/BentoOverview";
import { AnalyticsView } from "./components/AnalyticsView";
import { ShopsDirectoryView } from "./components/ShopsDirectoryView";
import { GlobalLedgerView } from "./components/GlobalLedgerView";
import { PricingEngineView } from "./components/PricingEngineView";
import { SystemHealthView } from "./components/SystemHealthView";
import { CreateShopModal } from "./components/CreateShopModal";
import { EditShopModal } from "./components/EditShopModal";

export default function PlatformAdminPage() {
  const [shops, setShops] = useState<ExtendedShop[]>([]);
  const [events, setEvents] = useState<GlobalPrintEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Global Platform Fee & GST State (stored in database)
  const [globalPlatformFee, setGlobalPlatformFee] = useState<number>(0.82);
  const [globalGstPercentage, setGlobalGstPercentage] = useState<number>(18);
  const [globalGstAmount, setGlobalGstAmount] = useState<number>(0.18);
  const [globalTotalCharge, setGlobalTotalCharge] = useState<number>(1.0);
  const [isSavingGlobalPricing, setIsSavingGlobalPricing] = useState(false);
  const [globalPricingMsg, setGlobalPricingMsg] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingShop, setEditingShop] = useState<ExtendedShop | null>(null);

  // Fee calculation helpers
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

  // Fetch Platform Data from Supabase
  const loadPlatformData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
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

      // 3. Fetch recent global print events (increased limit to 250 for richer analytics)
      const { data: eventsData, error: eventsErr } = await supabase
        .from("print_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);

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
      setIsRefreshing(false);
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
        ? `Are you sure you want to SUSPEND "${shop.name}"?\nCustomer print access will be immediately blocked via kill-switch.`
        : `Reactivate "${shop.name}"?\nCustomer print page will resume accepting jobs immediately.`;

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
          ? "Global rates saved & propagated to all shops!"
          : "Global fee settings saved to database successfully!"
      );
      setTimeout(() => setGlobalPricingMsg(""), 4000);
      loadPlatformData(true);
    } catch (err) {
      alert("Failed to save global pricing: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingGlobalPricing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[--color-foreground] relative overflow-x-hidden">
      {/* ─── Ambient Luminous Backdrop (Refracted by frosted glass) ─── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px]" />
      </div>

      {/* ─── Main Shell Layout ─── */}
      <div className="relative z-10 flex min-h-screen p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto gap-6">
        {/* Sleek Frosted Glass Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          shopsCount={shops.length}
          eventsCount={events.length}
          globalTotalCharge={globalTotalCharge}
          onOpenCreateModal={() => setShowCreateModal(true)}
          onRefresh={() => loadPlatformData()}
          isRefreshing={isRefreshing}
          isOpenMobile={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
        />

        {/* Content View Area */}
        <main className="flex-1 min-w-0 flex flex-col">
          <AdminHeader
            activeTab={activeTab}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
            onOpenCreateModal={() => setShowCreateModal(true)}
            onRefresh={() => loadPlatformData()}
            isRefreshing={isRefreshing}
            totalShops={shops.length}
          />

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 glass-panel rounded-3xl">
              <div className="w-10 h-10 border-4 border-black/10 border-t-black rounded-full animate-spin mb-4" />
              <div className="text-xs font-semibold text-[--color-muted]">
                Synchronizing decentralized mesh telemetry...
              </div>
            </div>
          ) : (
            <div className="flex-1">
              {/* Tab 1: Bento Overview */}
              {activeTab === "overview" && (
                <BentoOverview
                  shops={shops}
                  events={events}
                  globalPlatformFee={globalPlatformFee}
                  globalGstPercentage={globalGstPercentage}
                  globalGstAmount={globalGstAmount}
                  globalTotalCharge={globalTotalCharge}
                  onNavigateTab={setActiveTab}
                  onOpenCreateModal={() => setShowCreateModal(true)}
                  onToggleShopStatus={handleToggleStatus}
                />
              )}

              {/* Tab 2: Analytics & Trends (Requested by user!) */}
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

              {/* Tab 3: Shops Directory & Kill-Switch */}
              {activeTab === "shops" && (
                <ShopsDirectoryView
                  shops={shops}
                  search={search}
                  onSearchChange={setSearch}
                  onOpenCreateModal={() => setShowCreateModal(true)}
                  onOpenEditModal={(shop) => setEditingShop(shop)}
                  onToggleStatus={handleToggleStatus}
                />
              )}

              {/* Tab 4: Global Print Ledger */}
              {activeTab === "ledger" && (
                <GlobalLedgerView
                  events={events}
                  globalTotalCharge={globalTotalCharge}
                />
              )}

              {/* Tab 5: Fee & GST Engine */}
              {activeTab === "pricing" && (
                <PricingEngineView
                  globalPlatformFee={globalPlatformFee}
                  globalGstPercentage={globalGstPercentage}
                  globalGstAmount={globalGstAmount}
                  globalTotalCharge={globalTotalCharge}
                  onFeeChange={handleGlobalFeeChange}
                  onGstChange={handleGlobalGstChange}
                  onSavePricing={handleSaveGlobalPricing}
                  isSaving={isSavingGlobalPricing}
                  saveMsg={globalPricingMsg}
                />
              )}

              {/* Tab 6: System & Routing Health */}
              {activeTab === "health" && <SystemHealthView />}
            </div>
          )}
        </main>
      </div>

      {/* ─── Modals ─── */}
      <CreateShopModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onShopCreated={() => loadPlatformData(true)}
      />

      <EditShopModal
        shop={editingShop}
        onClose={() => setEditingShop(null)}
        onShopUpdated={() => loadPlatformData(true)}
        globalPlatformFee={globalPlatformFee}
        globalGstPercentage={globalGstPercentage}
      />
    </div>
  );
}
