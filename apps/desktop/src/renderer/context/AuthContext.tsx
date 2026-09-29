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
  login: (shopId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshShop: () => Promise<void>;
}

const STORAGE_KEY = "printap_shop_id";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    rawInput: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return { success: false, error: "Please enter your Shop ID or Slug" };
    }

    try {
      const shopDetails = await fetchShopDetails(trimmed);
      if (!shopDetails) {
        return {
          success: false,
          error: "Shop not found in system. Please verify your Shop ID or Slug.",
        };
      }

      if (shopDetails.status === "suspended") {
        return {
          success: false,
          error: "This shop account has been suspended.",
        };
      }

      localStorage.setItem(STORAGE_KEY, shopDetails.id);
      setShopId(shopDetails.id);
      setShop(shopDetails);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Authentication failed: ${msg}` };
    }
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
        login,
        logout,
        refreshShop,
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
