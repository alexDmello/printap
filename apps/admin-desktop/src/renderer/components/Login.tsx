import React, { useState } from "react";
import { getSupabase } from "@printap/shared";
import logoImg from "../assets/logo.png";

export function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      
      // 1. Authenticate with Supabase
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr || !authData.user) {
        throw new Error(authErr?.message || "Invalid credentials.");
      }

      // 2. Verify Admin Status (Security Check)
      const { data: adminData, error: adminErr } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("id", authData.user.id)
        .single();

      if (adminErr || !adminData) {
        // Not an admin! Sign them out immediately.
        await supabase.auth.signOut();
        throw new Error("Access Denied: You are not authorized as a Platform Admin.");
      }

      // 3. Success
      onLoginSuccess();
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src={logoImg} alt="Printap Admin" className="login-logo" />
        <h2>Admin Gateway</h2>
        <p className="login-subtitle">Secured Platform Access</p>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="login-error">{error}</div>}
          
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@mellod.in"
              required 
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Master Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required 
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? "Authenticating..." : "Authorize Access"}
          </button>
        </form>

        <div className="login-footer">
          <p>Protected by Supabase Auth & RLS</p>
        </div>
      </div>
    </div>
  );
}
