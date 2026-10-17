import { getSupabase } from "./supabase";

export const HEARTBEAT_INTERVAL_MS = 30_000;

export interface ShopPresencePayload {
  shopId: string;
  timestamp: string;
  isOnline: boolean;
}

export function presenceChannelName(shopId: string): string {
  return `presence:shop:${shopId}`;
}

export async function setShopOnline(
  shopId: string,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("set_shop_presence", {
      p_shop_id: shopId,
      p_is_online: isOnline,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    if (data && data.success === false) {
      return {
        success: false,
        error: data.error || "Failed to update shop presence",
      };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

