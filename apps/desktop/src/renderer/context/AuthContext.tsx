import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getSupabase } from "@printap/shared";

export interface ShopInfo {
  id: string;
  name: string;
  upi_vpa: string;
  status: string;
  created_at: string;
}

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

  const fetchShopDetails = useCallback(async (id: string): Promise<ShopInfo | null> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.warn("[Auth] Failed to load shop:", error?.message);
        return null;
      }
      return data as ShopInfo;
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
    rawShopId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = rawShopId.trim();
    if (!trimmed) {
      return { success: false, error: "Please enter a valid Shop ID" };
    }

    // Basic UUID validator
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      return {
        success: false,
        error: "Invalid Shop ID format. Must be a valid UUID.",
      };
    }

    try {
      const shopDetails = await fetchShopDetails(trimmed);
      if (!shopDetails) {
        return {
          success: false,
          error: "Shop not found in system. Please verify your Shop ID.",
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
