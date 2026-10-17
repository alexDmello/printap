import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getSupabase } from "@printap/shared";
import { IconCash } from "./Icons";

interface TokenTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  created_at: string;
}

export const Tokens: React.FC = React.memo(() => {
  const { shopId, shop } = useAuth();
  const [tokenAmount, setTokenAmount] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchTransactions = async () => {
    if (!shopId) return;
    setIsLoadingHistory(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("token_transactions")
        .select("id, type, amount, balance_after, created_at")
        .eq("shop_id", shopId)
        .eq("type", "topup")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data && !error) {
        setTransactions(data as TokenTransaction[]);
      }
    } catch (err) {
      console.error("Error fetching token history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [shopId]);

  const handleTopup = async () => {
    if (!shopId || tokenAmount <= 0) return;
    setIsProcessing(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "https://www.mellod.in";
      const response = await fetch(`${apiUrl}/api/tokens/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, amount: tokenAmount }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkoutUrl) {
          if (window.electronAPI?.openExternal) {
            await window.electronAPI.openExternal(data.checkoutUrl);
          } else {
            window.open(data.checkoutUrl, "_blank");
          }
          setSuccessMsg("Checkout opened in browser. Tokens will credit automatically upon payment confirmation.");
          setTokenAmount(100);
          fetchTransactions();
          return;
        }
        if (data.success) {
          setSuccessMsg(`Successfully added ${tokenAmount} tokens!`);
          setTokenAmount(100);
          fetchTransactions();
          return;
        }
      }

      setErrorMsg("Payment gateway is in admin-approval mode. Please contact platform support or admin console to approve token top-up.");
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during top-up.");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentBalance = (shop as any)?.token_balance || 0;

  return (
    <div className="content fade-in" style={{ paddingBottom: 60 }}>
      <div className="page-header">
        <h1 className="page-title">
          <span>Token Top-up</span>
          <span className="status-badge active">Tokens: {currentBalance}</span>
        </h1>
        <p className="page-subtitle">
          Purchase tokens to keep your shop online. 1 Token = 1 successful print session. (₹1 per Token)
        </p>
      </div>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* Topup Form */}
        <div className="card" style={{ flex: "1 1 350px" }}>
          <div className="card-header">
            <div className="card-title">Buy Print Tokens</div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                Enter Token Amount
              </label>
              <input
                type="number"
                min="1"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(Number(e.target.value) || 0)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 16,
                  fontFamily: "var(--font-mono)",
                  color: "#16181D",
                  backgroundColor: "#FFFFFF",
                  outline: "none"
                }}
              />
            </div>

            <div style={{ 
              padding: "12px 16px", 
              backgroundColor: "rgba(240, 235, 237, 0.5)", 
              borderRadius: "var(--radius-sm)", 
              border: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>Total Price</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>₹{tokenAmount * 1}</span>
            </div>

            {errorMsg && (
              <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(22,24,29,0.06)", border: "1px solid var(--border-subtle)", color: "#16181D", fontSize: 13, fontWeight: 500 }}>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(22,24,29,0.06)", border: "1px solid var(--border-subtle)", color: "#16181D", fontSize: 13, fontWeight: 500 }}>
                {successMsg}
              </div>
            )}

            <button
              onClick={handleTopup}
              disabled={isProcessing || tokenAmount <= 0}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#16181D",
                color: "#ffffff",
                borderRadius: "var(--radius-sm)",
                border: "1px solid #16181D",
                fontWeight: 600,
                fontSize: 14,
                cursor: (isProcessing || tokenAmount <= 0) ? "not-allowed" : "pointer",
                opacity: (isProcessing || tokenAmount <= 0) ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 8
              }}
            >
              <IconCash size={18} />
              {isProcessing ? "Processing..." : `Pay & Top-up ₹${tokenAmount * 1}`}
            </button>
          </div>
        </div>

        {/* Topup History */}
        <div className="card" style={{ flex: "1 1 400px" }}>
          <div className="card-header">
            <div className="card-title">Recent Top-ups</div>
          </div>
          <div className="card-body">
            {isLoadingHistory ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading history...</p>
            ) : transactions.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No top-ups found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {transactions.map((tx) => (
                  <div key={tx.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "#FFFFFF"
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#16181D", fontFamily: "var(--font-mono)" }}>+{tx.amount} Tokens</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      Bal: {tx.balance_after}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
