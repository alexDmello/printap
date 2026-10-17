import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shop Onboarding Session Retention Policy:
 * On mellod.in, the shop onboarding login session is retained strictly for 10 minutes (600,000 ms).
 * Once 10 minutes have elapsed since authentication, the session is invalidated and signed out.
 */
export const LOGIN_SESSION_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
export const LOGIN_STORAGE_KEY = "printap_auth_login_at";

/**
 * Sets the active login session timestamp.
 */
export function setLoginSessionTime(timestamp: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOGIN_STORAGE_KEY, timestamp.toString());
  } catch {}
}

/**
 * Retrieves the recorded login timestamp, or null if unset.
 */
export function getLoginSessionTime(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(LOGIN_STORAGE_KEY);
    if (!val) return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

/**
 * Clears the login session timestamp.
 */
export function clearLoginSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
  } catch {}
}

/**
 * Calculates remaining session time in milliseconds (clamped to 0).
 */
export function getLoginSessionRemainingMs(): number {
  const loginAt = getLoginSessionTime();
  if (!loginAt) return 0;
  const elapsed = Date.now() - loginAt;
  return Math.max(0, LOGIN_SESSION_MAX_AGE_MS - elapsed);
}

/**
 * Returns true if the login session has exceeded the 10-minute maximum age.
 */
export function isLoginSessionExpired(): boolean {
  const loginAt = getLoginSessionTime();
  if (!loginAt) return true;
  return Date.now() - loginAt >= LOGIN_SESSION_MAX_AGE_MS;
}

/**
 * Formats milliseconds into human-readable "Xm Ys" (e.g. "9m 45s").
 */
export function formatRemainingTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/**
 * Enforces the 10-minute maximum session age against the Supabase browser client.
 * If expired or older than 10 minutes, signs out the user and clears storage.
 */
export async function enforceSessionTimeout(
  supabase: SupabaseClient
): Promise<{ valid: boolean; remainingMs: number }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      clearLoginSession();
      return { valid: false, remainingMs: 0 };
    }

    let loginAt = getLoginSessionTime();

    // If no timestamp was recorded in localStorage, derive from user.last_sign_in_at or set to now
    if (!loginAt) {
      if (session.user.last_sign_in_at) {
        loginAt = new Date(session.user.last_sign_in_at).getTime();
      } else {
        loginAt = Date.now();
      }
      setLoginSessionTime(loginAt);
    }

    const elapsed = Date.now() - loginAt;
    if (elapsed >= LOGIN_SESSION_MAX_AGE_MS) {
      clearLoginSession();
      await supabase.auth.signOut();
      return { valid: false, remainingMs: 0 };
    }

    return { valid: true, remainingMs: LOGIN_SESSION_MAX_AGE_MS - elapsed };
  } catch (err) {
    console.warn("[SessionManager] Error enforcing session timeout:", err);
    return { valid: true, remainingMs: LOGIN_SESSION_MAX_AGE_MS };
  }
}
