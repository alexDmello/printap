import React, { useState, useEffect, useCallback } from "react";
import { getSupabase, ROOT_DOMAIN } from "@printap/shared";
import type { ExtendedShop, GlobalPrintEvent, NavigationTab } from "./types";
import { Sidebar } from "./components/Sidebar";
import { OverviewView } from "./components/OverviewView";
import { AnalyticsView } from "./components/AnalyticsView";
import { ShopsView } from "./components/ShopsView";
import { LedgerView } from "./components/LedgerView";
import { HealthView } from "./components/HealthView";
import { EditShopModal } from "./components/EditShopModal";
import { DeleteShopModal } from "./components/DeleteShopModal";
import { IconMenu, IconRefresh } from "./components/Icons";
import { Login } from "./components/Login";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shops, setShops] = useState<ExtendedShop[]>([]);
  const [events, setEvents] = useState<GlobalPrintEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavigationTab>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Modals state
  const [editingShop, setEditingShop] = useState<ExtendedShop | null>(null);
  const [deletingShop, setDeletingShop] = useState<ExtendedShop | null>(null);

  const loadPlatformData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      // 1. Fetch all shops
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
        .limit(1000);

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

  // Check initial session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = getSupabase();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session fetch error:", error);
        }

        if (session?.user) {
          // Verify admin status
          const { data: adminData, error: adminErr } = await supabase
            .from("platform_admins")
            .select("id")
            .eq("id", session.user.id)
            .maybeSingle();
            
          if (adminErr) {
            console.error("Admin verification error:", adminErr);
          }
            
          if (adminData) {
            setIsAuthenticated(true);
          } else {
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error("Unexpected error in checkSession:", err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadPlatformData();
    }
  }, [loadPlatformData, isAuthenticated]);

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

  const activeCount = shops.filter((s) => s.status === "active").length;
  const suspendedCount = shops.filter((s) => s.status === "suspended").length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-zinc-500 font-mono text-sm">
        Authenticating Platform...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="wabi-root text-zinc-900 flex min-h-screen bg-white">
      {/* White Left Sidebar Rail */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        shopsCount={shops.length}
        activeCount={activeCount}
        eventsCount={events.length}
        onRefresh={loadPlatformData}
        loading={loading}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:text-black border border-zinc-200"
            >
              <IconMenu size={18} />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400">Desktop /</span>
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-black">
                {activeTab === "overview" && "Bento Overview"}
                {activeTab === "analytics" && "Analytics Suite"}
                {activeTab === "shops" && "Shops Directory"}
                {activeTab === "ledger" && "Print Ledger"}
                {activeTab === "health" && "System Topology"}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-300">
                Electron Standalone
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
              setActiveTab={setActiveTab}
              onToggleStatus={handleToggleStatus}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsView
              shops={shops}
              events={events}
            />
          )}

          {activeTab === "shops" && (
            <ShopsView
              shops={shops}
              onOpenEditModal={(shop) => setEditingShop(shop)}
              onOpenDeleteModal={(shop) => setDeletingShop(shop)}
              onToggleStatus={handleToggleStatus}
            />
          )}

          {activeTab === "ledger" && (
            <LedgerView
              events={events}
              shops={shops}
            />
          )}

          {activeTab === "health" && <HealthView />}
        </main>
      </div>

      {/* Floating Modals */}
      <EditShopModal
        shop={editingShop}
        onClose={() => setEditingShop(null)}
        onSuccess={loadPlatformData}
        onOpenDeleteModal={(shop) => setDeletingShop(shop)}
      />

      <DeleteShopModal
        shop={deletingShop}
        onClose={() => setDeletingShop(null)}
        onSuccess={() => {
          setDeletingShop(null);
          loadPlatformData();
        }}
      />
    </div>
  );
}

export { App };
