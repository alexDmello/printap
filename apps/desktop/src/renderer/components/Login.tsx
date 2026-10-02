import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { IconShield, IconCheck } from "./Icons";
import logoImg from "../assets/logo.png";

const SAVED_EMAIL_KEY = "printap_saved_email";

export const Login: React.FC = () => {
  const { login, sendResetOtp, resetPassword } = useAuth();

  // Login form state
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Load saved email on mount
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      setEmailInput(saved);
      setForgotEmail(saved);
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await login(emailInput.trim(), passwordInput);
    if (!result.success) {
      setErrorMessage(result.error || "Terminal authentication failed.");
      setIsSubmitting(false);
    } else {
      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, emailInput.trim());
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
      }
    }
  };

  // Step 1: Send OTP for password reset
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      setForgotError("Please enter a valid registered email address.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    const res = await sendResetOtp(forgotEmail.trim());
    if (res.success) {
      setForgotStep(2);
      setResendCooldown(60);
    } else {
      setForgotError(res.error || "Failed to send reset code.");
    }
    setForgotLoading(false);
  };

  // Step 2: Confirm OTP & set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.trim().length !== 6) {
      setForgotError("Please enter the 6-digit verification code.");
      return;
    }
    if (newPassword.length < 8) {
      setForgotError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    const res = await resetPassword(forgotEmail.trim(), forgotOtp.trim(), newPassword);
    if (res.success) {
      setForgotSuccess("Password reset successfully! You can now log in.");
      setEmailInput(forgotEmail.trim());
      setPasswordInput(newPassword);
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotOtp("");
        setNewPassword("");
        setConfirmNewPassword("");
        setForgotSuccess(null);
      }, 1500);
    } else {
      setForgotError(res.error || "Password reset failed.");
    }
    setForgotLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card fade-in">
        <div className="login-brand-icon">
          <img src={logoImg} alt="Printap" />
        </div>

        <h1 className="login-title">Printap Counter Terminal</h1>
        <p className="login-subtitle">
          Sign in with your registered shop email and password to connect your counter terminal.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          {/* Email Input */}
          <div style={{ textAlign: "left", marginBottom: 6 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
              }}
            >
              Shop Owner Email
            </label>
          </div>
          <input
            type="email"
            className="login-input"
            placeholder="e.g. rahul@apexprints.com"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            disabled={isSubmitting}
            autoFocus
            required
          />

          {/* Password Input */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Terminal Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "none",
                border: "none",
                fontSize: 11,
                color: "var(--accent-primary, #6366f1)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            className="login-input"
            placeholder="Enter your password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            disabled={isSubmitting}
            required
          />

          {/* Remember Email & Forgot Password */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
              fontSize: 12,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                style={{ cursor: "pointer", accentColor: "var(--accent-primary, #6366f1)" }}
              />
              Remember Email
            </label>

            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true);
                setForgotEmail(emailInput || "");
                setForgotError(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent-primary, #6366f1)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Forgot Password?
            </button>
          </div>

          {errorMessage && <div className="login-error" style={{ marginTop: 14 }}>{errorMessage}</div>}

          {/* Connect Button */}
          <button
            type="submit"
            className="login-btn"
            style={{ marginTop: 20 }}
            disabled={isSubmitting || !emailInput.trim() || !passwordInput}
          >
            {isSubmitting ? "Connecting Terminal..." : "Connect Counter Terminal"}
          </button>
        </form>

        {/* Onboarding Link */}
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
          Need to onboard a new shop?{" "}
          <a
            href="https://www.mellod.in/onboard"
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--accent-primary, #6366f1)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Register on Web →
          </a>
        </div>

        {/* Trust Badges */}
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

      {/* MODAL: FORGOT & RESET PASSWORD */}
      {showForgotModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="login-card fade-in"
            style={{
              maxWidth: 400,
              width: "100%",
              margin: 0,
              background: "var(--surface-primary, #1e1e24)",
              border: "1px solid var(--border-subtle, #333)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px 0", color: "#fff" }}>
              Reset Terminal Password
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              {forgotStep === 1
                ? "Enter your registered shop owner email to receive a 6-digit reset code."
                : `Enter the 6-digit code sent to ${forgotEmail} and choose a new password.`}
            </p>

            {forgotError && (
              <div className="login-error" style={{ marginBottom: 14 }}>
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid #10b981",
                  color: "#34d399",
                  padding: 10,
                  borderRadius: 8,
                  fontSize: 12,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <IconCheck size={14} />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendResetCode}>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Enter registered email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotLoading}
                  autoFocus
                  required
                />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setShowForgotModal(false)}
                    disabled={forgotLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="login-btn"
                    style={{ flex: 1, marginTop: 0 }}
                    disabled={forgotLoading || !forgotEmail.trim()}
                  >
                    {forgotLoading ? "Sending Code..." : "Send Reset Code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    className="login-input"
                    placeholder="e.g. 123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/[^0-9]/g, ""))}
                    style={{ letterSpacing: 4, textAlign: "center", fontWeight: 700, fontSize: 18 }}
                    disabled={forgotLoading}
                    autoFocus
                    required
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    New Password (min. 8 characters)
                  </label>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={forgotLoading}
                    required
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={forgotLoading}
                    required
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, fontSize: 11 }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
                  >
                    ← Change Email
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (resendCooldown > 0) return;
                      await sendResetOtp(forgotEmail.trim());
                      setResendCooldown(60);
                    }}
                    disabled={resendCooldown > 0 || forgotLoading}
                    style={{
                      background: "none",
                      border: "none",
                      color: resendCooldown > 0 ? "var(--text-muted)" : "var(--accent-primary, #6366f1)",
                      cursor: resendCooldown > 0 ? "default" : "pointer",
                      padding: 0,
                      fontWeight: 600,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setShowForgotModal(false)}
                    disabled={forgotLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="login-btn"
                    style={{ flex: 1, marginTop: 0 }}
                    disabled={forgotLoading || forgotOtp.length !== 6 || newPassword.length < 8}
                  >
                    {forgotLoading ? "Resetting..." : "Set New Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
