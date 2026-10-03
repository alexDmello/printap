import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getSupabase, sanitizeSubdomain, type ShopInfo } from "@printap/shared";

export type { ShopInfo };

export interface AuthContextType {
  isAuthenticated: boolean;
  shopId: string | null;
  shop: ShopInfo | null;
  isLoading: boolean;
  isGoogleSigningIn: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  cancelGoogleLogin: () => void;
  reopenGoogleBrowser: () => void;
  logout: () => void;
  refreshShop: () => Promise<void>;
  sendResetOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
}

const STORAGE_KEY = "printap_shop_id";
const SAVED_EMAIL_KEY = "printap_saved_email";
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://www.mellod.in";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const activeGoogleSessionRef = React.useRef<{
    cancel: () => void;
    reopenBrowser: () => void;
  } | null>(null);

  const fetchShopDetails = useCallback(async (idOrSlug: string): Promise<ShopInfo | null> => {
    try {
      const supabase = getSupabase();
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          idOrSlug
        );

      let query = supabase.from("shops").select("*");
      if (isUuid) {
        query = query.eq("id", idOrSlug);
      } else {
        query = query.eq("slug", idOrSlug.toLowerCase());
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        // Fallback: match by sanitized name if slug is not set
        const { data: allActive } = await supabase
          .from("shops")
          .select("*")
          .eq("status", "active");

        if (allActive && allActive.length > 0) {
          const match = allActive.find(
            (s) => sanitizeSubdomain(s.name) === sanitizeSubdomain(idOrSlug)
          );
          if (match) {
            const resolved = match as ShopInfo;
            if (!resolved.slug) resolved.slug = sanitizeSubdomain(resolved.name);
            return resolved;
          }
        }

        console.warn("[Auth] Failed to load shop:", error?.message);
        return null;
      }

      const resolvedShop = data as ShopInfo;
      // Auto-ensure slug is always populated from shop name
      if (!resolvedShop.slug && resolvedShop.name) {
        resolvedShop.slug = sanitizeSubdomain(resolvedShop.name);
      }

      return resolvedShop;
    } catch (err) {
      console.error("[Auth] Error fetching shop details:", err);
      return null;
    }
  }, []);

  // Restore saved shop from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const shopDetails = await fetchShopDetails(savedId.trim());
        if (shopDetails && shopDetails.status !== "suspended") {
          setShopId(shopDetails.id);
          setShop(shopDetails);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [fetchShopDetails]);

  const login = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanIdentifier = identifier.trim().toLowerCase();
    if (!cleanIdentifier) {
      return { success: false, error: "Please enter your email or shop subdomain handle." };
    }
    if (!password) {
      return { success: false, error: "Please enter your password." };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanIdentifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Authentication failed." };
      }

      const shopDetails = data.shop as ShopInfo;
      localStorage.setItem(STORAGE_KEY, shopDetails.id);
      setShopId(shopDetails.id);
      setShop(shopDetails);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Connection failed: ${msg}` };
    }
  };

  const sendResetOtp = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, error: "Please enter a valid email address." };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, purpose: "reset_password" }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to send reset code." };
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Network error: ${msg}` };
    }
  };

  const resetPassword = async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Password reset failed." };
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Network error: ${msg}` };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    const sessionId = crypto.randomUUID();
    setIsGoogleSigningIn(true);

    const authUrl = `${API_BASE_URL}/auth/desktop-login?session=${encodeURIComponent(sessionId)}`;

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        if (channel) {
          try {
            channel.unsubscribe();
          } catch {}
        }
        if (pollTimer) clearInterval(pollTimer);
        if (deepLinkCleanup) deepLinkCleanup();
        setIsGoogleSigningIn(false);
        activeGoogleSessionRef.current = null;
      };

      const onSuccess = async (shopData: ShopInfo) => {
        if (settled) return;
        settled = true;
        cleanup();
        localStorage.setItem(STORAGE_KEY, shopData.id);
        setShopId(shopData.id);
        setShop(shopData);
        resolve({ success: true });
      };

      const onError = (error: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ success: false, error });
      };

      // 1. Listen via Supabase Realtime Broadcast Channel
      const supabase = getSupabase();
      const channel = supabase.channel(`desktop-auth:${sessionId}`, {
        config: { broadcast: { self: false } },
      });

      channel.on("broadcast", { event: "login-success" }, async ({ payload }) => {
        console.log("[Auth] Google login broadcast success:", payload);
        const p = payload as { shopId?: string; shop?: ShopInfo };
        if (p.shop) {
          onSuccess(p.shop);
        } else if (p.shopId) {
          const s = await fetchShopDetails(p.shopId);
          if (s) onSuccess(s);
          else onError("Failed to load shop details after login.");
        }
      });

      channel.on("broadcast", { event: "login-error" }, ({ payload }) => {
        const p = payload as { error?: string };
        onError(p.error || "Google authentication failed.");
      });

      channel.subscribe();

      // 2. Secondary Fallback: Poll desktop-session API every 1.5s
      const pollTimer = setInterval(async () => {
        if (settled) return;
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/auth/desktop-session?session=${encodeURIComponent(sessionId)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.status === "authenticated" && data.shop) {
              onSuccess(data.shop as ShopInfo);
            }
          }
        } catch {}
      }, 1500);

      // 3. Tertiary: Deep-link listener from Electron main process
      let deepLinkCleanup: (() => void) | null = null;
      if (window.electronAPI?.onDeepLinkAuth) {
        deepLinkCleanup = window.electronAPI.onDeepLinkAuth(
          async ({ sessionId: linkSession, shopId: linkShopId }) => {
            if (linkSession === sessionId && linkShopId) {
              const s = await fetchShopDetails(linkShopId);
              if (s) onSuccess(s);
            }
          }
        );
      }

      // Open external system browser
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(authUrl);
      } else {
        window.open(authUrl, "_blank");
      }

      // Store controller for cancellation or re-opening
      activeGoogleSessionRef.current = {
        cancel: () => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve({ success: false, error: "Login cancelled by user." });
          }
        },
        reopenBrowser: () => {
          if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(authUrl);
          } else {
            window.open(authUrl, "_blank");
          }
        },
      };
    });
  };

  const cancelGoogleLogin = () => {
    activeGoogleSessionRef.current?.cancel();
  };

  const reopenGoogleBrowser = () => {
    activeGoogleSessionRef.current?.reopenBrowser();
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShopId(null);
    setShop(null);
  };

  const refreshShop = async () => {
    if (!shopId) return;
    const updated = await fetchShopDetails(shopId);
    if (updated) setShop(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!shopId && !!shop,
        shopId,
        shop,
        isLoading,
        isGoogleSigningIn,
        login,
        loginWithGoogle,
        cancelGoogleLogin,
        reopenGoogleBrowser,
        logout,
        refreshShop,
        sendResetOtp,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
