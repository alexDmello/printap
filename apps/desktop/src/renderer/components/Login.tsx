import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { IconPrinter, IconShield } from "./Icons";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [shopIdInput, setShopIdInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopIdInput.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await login(shopIdInput);
    if (!result.success) {
      setErrorMessage(result.error || "Terminal authentication failed.");
    }
    setIsSubmitting(false);
  };

  const handleUseDemo = () => {
    setShopIdInput("16ab79f4-789b-4b04-a4a0-e2071ec948ec");
    setErrorMessage(null);
  };

  return (
    <div className="login-container">
      <div className="login-card fade-in">
        <div className="login-brand-icon">
          <IconPrinter size={24} color="#ffffff" />
        </div>

        <h1 className="login-title">Printap Counter Agent</h1>
        <p className="login-subtitle">
          Connect your counter desktop agent to receive encrypted peer-to-peer WebRTC print jobs.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ textAlign: "left", marginBottom: 8 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
              }}
            >
              Shop ID (Terminal UUID)
            </label>
          </div>

          <input
            type="text"
            className="login-input"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={shopIdInput}
            onChange={(e) => {
              setShopIdInput(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            disabled={isSubmitting}
            autoFocus
          />

          {errorMessage && <div className="login-error">{errorMessage}</div>}

          <button
            type="submit"
            className="login-btn"
            style={{ marginTop: 18 }}
            disabled={isSubmitting || !shopIdInput.trim()}
          >
            {isSubmitting ? "Connecting..." : "Connect Counter Terminal"}
          </button>
        </form>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ width: "100%", justifyContent: "center", borderRadius: "var(--radius-full)" }}
            onClick={handleUseDemo}
          >
            Use Demo Shop ID
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 24,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <IconShield size={14} color="var(--accent-emerald)" />
          <span>Zero Cloud Storage • Direct Peer-to-Peer</span>
        </div>
      </div>
    </div>
  );
};
