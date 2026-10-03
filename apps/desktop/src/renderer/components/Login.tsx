import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { IconShield, IconCheck } from "./Icons";
import { validateEmail } from "@printap/shared";
import logoImg from "../assets/logo.png";

const SAVED_EMAIL_KEY = "printap_saved_email";

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg style={{ width: size, height: size, flexShrink: 0 }} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const Login: React.FC = () => {
  const {
    login,
    loginWithGoogle,
    isGoogleSigningIn,
    cancelGoogleLogin,
    reopenGoogleBrowser,
    sendResetOtp,
    resetPassword,
  } = useAuth();

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
    const cleanId = emailInput.trim();
    if (!cleanId) {
      setErrorMessage("Please enter your email address or shop handle.");
      return;
    }
    if (!passwordInput) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await login(cleanId, passwordInput);
    if (!result.success) {
      setErrorMessage(result.error || "Terminal authentication failed.");
      setIsSubmitting(false);
    } else {
      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, cleanId);
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    const result = await loginWithGoogle();
    if (!result.success && result.error && result.error !== "Login cancelled by user.") {
      setErrorMessage(result.error);
    }
  };

  // Step 1: Send OTP for password reset
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailCheck = validateEmail(forgotEmail);
    if (!emailCheck.valid) {
      setForgotError(emailCheck.reason || "Please enter a valid registered email address.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);

    const res = await sendResetOtp(emailCheck.normalizedEmail);
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
          Sign in with your registered shop account to connect your counter terminal.
        </p>

        {/* Google Sign-In Option */}
        <div style={{ marginTop: 20 }}>
          {isGoogleSigningIn ? (
            <div className="login-waiting-card fade-in">
              <div className="login-waiting-spinner" />
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  Authorizing with Google...
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Check your browser tab to complete sign-in.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={reopenGoogleBrowser}
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  title="Reopen login tab in browser"
                >
                  Reopen
                </button>
                <button
                  type="button"
                  onClick={cancelGoogleLogin}
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: "4px 8px", color: "var(--accent-rose, #f43f5e)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isGoogleSigningIn}
              className="login-google-btn"
            >
              <GoogleIcon size={18} />
              <span>Continue with Google</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="login-divider">
          <span>or sign in with password</span>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 0 }}>
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
              Shop Email or Subdomain Handle
            </label>
          </div>
          <input
            type="text"
            className="login-input"
            placeholder="e.g. rahul@gmail.com or apex-prints"
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
