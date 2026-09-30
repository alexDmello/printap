import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getSupabase } from "@printap/shared";
import { IconHistory, IconRefresh, IconFileText, IconCheck, IconCash } from "./Icons";
import type { LiveJob } from "./LiveDashboard";

export type HistoryDateFilter = "all_time" | "today" | "yesterday" | "this_week" | "this_month";

export interface PrintOrderRecord {
  id: string;
  shop_id: string;
  session_id: string;
  token_code: string | null;
  payment_method: "upi" | "cash" | string | null;
  payment_status: string;
  total_amount: number;
  status: string;
  created_at: string;
  file_count?: number;
}

interface PrintHistoryProps {
  recentJobs?: LiveJob[];
}

export const PrintHistory: React.FC<PrintHistoryProps> = ({ recentJobs = [] }) => {
  const { shopId, shop } = useAuth();
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>("all_time");
  const [methodFilter, setMethodFilter] = useState<"all" | "upi" | "cash">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<PrintOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("print_orders")
        .select("id, shop_id, session_id, token_code, payment_method, payment_status, total_amount, status, created_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data as PrintOrderRecord[]);
      }
    } catch (err) {
      console.error("[PrintHistory] Error loading print history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Combine fetched orders with in-memory recent jobs (avoid duplicates by session_id)
  const allOrders = useMemo(() => {
    const map = new Map<string, PrintOrderRecord>();

    // 1. Add DB orders
    orders.forEach((o) => {
      map.set(o.session_id, o);
    });

    // 2. Overlay recent jobs
    recentJobs.forEach((j) => {
      if (!j.sessionId) return;
      const existing = map.get(j.sessionId);
      if (existing) {
        map.set(j.sessionId, {
          ...existing,
          token_code: j.tokenCode || existing.token_code,
          total_amount: j.totalAmount !== undefined && j.totalAmount > 0 ? j.totalAmount : existing.total_amount,
          payment_status: j.paymentStatus || existing.payment_status,
          file_count: j.files?.length || j.fileCount || existing.file_count,
        });
      } else {
        map.set(j.sessionId, {
          id: j.sessionId,
          shop_id: shopId || "",
          session_id: j.sessionId,
          token_code: j.tokenCode || null,
          payment_method: j.paymentMethod || "upi",
          payment_status: j.paymentStatus || "pending",
          total_amount: j.totalAmount || 0,
          status: j.status || "done",
          created_at: (j.timestamp || new Date()).toISOString(),
          file_count: j.files?.length || j.fileCount || 1,
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [orders, recentJobs, shopId]);

  // Filter orders by date, payment method, and search
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = startOfToday;
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return allOrders.filter((order) => {
      const orderDate = new Date(order.created_at);

      // Date range filtering
      if (dateFilter === "today") {
        if (orderDate < startOfToday) return false;
      } else if (dateFilter === "yesterday") {
        if (orderDate < startOfYesterday || orderDate >= endOfYesterday) return false;
      } else if (dateFilter === "this_week") {
        if (orderDate < startOfWeek) return false;
      } else if (dateFilter === "this_month") {
        if (orderDate < startOfMonth) return false;
      }

      // Payment method filtering
      if (methodFilter !== "all") {
        if (order.payment_method?.toLowerCase() !== methodFilter) return false;
      }

      // Text search filtering (Token Code or Session ID)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesToken = (order.token_code || "").toLowerCase().includes(q);
        const matchesSession = (order.session_id || "").toLowerCase().includes(q);
        if (!matchesToken && !matchesSession) return false;
      }

      return true;
    });
  }, [allOrders, dateFilter, methodFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let upiRevenue = 0;
    let cashRevenue = 0;

    filteredOrders.forEach((o) => {
      const amt = Number(o.total_amount) || 0;
      totalRevenue += amt;
      if (o.payment_method === "upi") upiRevenue += amt;
      else if (o.payment_method === "cash") cashRevenue += amt;
    });

    return {
      count: filteredOrders.length,
      totalRevenue,
      upiRevenue,
      cashRevenue,
    };
  }, [filteredOrders]);

  return (
    <div className="content fade-in" style={{ paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title">
            <IconHistory size={24} style={{ color: "var(--text-primary)" }} />
            <span>Print History</span>
          </h1>
          <p className="page-subtitle">
            Complete archive of all printed documents, tokens, and verified payments for {shop?.name || "your counter"}.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          disabled={isLoading}
          className="btn-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Refresh orders from database"
        >
          <IconRefresh size={15} className={isLoading ? "spin" : ""} />
          <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">
            <span>Total Prints Filtered</span>
            <IconFileText size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{stats.count}</div>
          <div className="stat-footnote">Customer print orders</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Revenue Collected</span>
            <IconCash size={16} color="var(--accent-emerald)" />
          </div>
          <div className="stat-value" style={{ color: "var(--accent-emerald)" }}>
            ₹{stats.totalRevenue.toFixed(2)}
          </div>
          <div className="stat-footnote">
            UPI: ₹{stats.upiRevenue.toFixed(2)} • Cash: ₹{stats.cashRevenue.toFixed(2)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <span>Average Order Value</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>₹/order</span>
          </div>
          <div className="stat-value">
            ₹{stats.count > 0 ? (stats.totalRevenue / stats.count).toFixed(2) : "0.00"}
          </div>
          <div className="stat-footnote">Per session average</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: "14px 18px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Left: Date Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              { id: "all_time", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "Last 7 Days" },
              { id: "this_month", label: "This Month" },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDateFilter(preset.id)}
              className={`pill-btn ${dateFilter === preset.id ? "active" : ""}`}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: "var(--radius-full)",
                border: dateFilter === preset.id ? "1px solid #09090b" : "1px solid var(--border-subtle)",
                background: dateFilter === preset.id ? "#09090b" : "transparent",
                color: dateFilter === preset.id ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "var(--transition)",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Right: Method Filter & Search Box */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Method toggle */}
          <div style={{ display: "inline-flex", borderRadius: "var(--radius-md)", background: "rgba(0, 0, 0, 0.04)", padding: 2 }}>
            {(
              [
                { id: "all", label: "All" },
                { id: "upi", label: "UPI" },
                { id: "cash", label: "Cash" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethodFilter(m.id)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: methodFilter === m.id ? "#ffffff" : "transparent",
                  color: methodFilter === m.id ? "#09090b" : "var(--text-muted)",
                  boxShadow: methodFilter === m.id ? "var(--shadow-sm)" : "none",
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <input
            type="text"
            placeholder="Search Token (e.g. #214)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              background: "rgba(255, 255, 255, 0.8)",
              color: "var(--text-primary)",
              outline: "none",
              minWidth: 180,
            }}
          />
        </div>
      </div>

      {/* Orders List / Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0, 0, 0, 0.01)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            Archived Print Orders ({filteredOrders.length})
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Sorted by newest first
          </span>
        </div>

        {filteredOrders.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredOrders.map((order, idx) => {
              const dateObj = new Date(order.created_at);
              const formattedDate = dateObj.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = dateObj.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const amount = Number(order.total_amount) || 0;
              const isCopied = copiedId === order.session_id;

              return (
                <div
                  key={order.session_id || order.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    borderBottom: idx < filteredOrders.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    gap: 12,
                    flexWrap: "wrap",
                    transition: "var(--transition)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Left: Token badge & date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 200 }}>
                    <span
                      className="token-pill"
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        padding: "5px 12px",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {order.token_code || "#--"}
                    </span>

                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {formattedDate} • {formattedTime}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                        Session: {order.session_id ? order.session_id.slice(0, 8) + "..." : "Local"}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Method badge & Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          order.payment_method === "upi"
                            ? "rgba(99, 102, 241, 0.1)"
                            : "rgba(245, 158, 11, 0.1)",
                        color:
                          order.payment_method === "upi"
                            ? "#4f46e5"
                            : "#b45309",
                        textTransform: "uppercase",
                      }}
                    >
                      {order.payment_method ? order.payment_method.toUpperCase() : "UPI"}
                    </span>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#059669",
                        background: "rgba(16, 185, 129, 0.1)",
                        padding: "3px 8px",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <IconCheck size={12} />
                      <span>Settled & Paid</span>
                    </span>
                  </div>

                  {/* Right: Amount & Copy */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#09090b" }}>
                        ₹{amount.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        Verified
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(order.token_code || order.session_id, order.session_id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        background: "rgba(0, 0, 0, 0.03)",
                        color: "var(--text-secondary)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="Copy Token Code"
                    >
                      {isCopied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(0, 0, 0, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                color: "var(--text-muted)",
              }}
            >
              <IconHistory size={22} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
              No Print Orders Found
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {searchQuery || dateFilter !== "all_time" || methodFilter !== "all"
                ? "Try adjusting your search query or date filters."
                : "Completed print orders will automatically appear in this archive."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
