import { getSupabase } from "./supabase";

export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Returns the standardized Supabase Realtime channel name for a shop's presence room.
 */
export function presenceChannelName(shopId: string): string {
  return `presence:${shopId}`;
}

export interface ShopPresencePayload {
  shopId: string;
  timestamp: string;
  isOnline: boolean;
}

/**
 * Updates the database record for shop online status and last seen timestamp.
 * Resilient against network glitches.
 */
export async function setShopOnline(
  shopId: string,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("shops")
      .update({
        is_online: isOnline,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", shopId);

    if (error) {
      console.error(
        `[presence] Failed to set shop ${shopId} online=${isOnline}:`,
        error
      );
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[presence] Exception setting shop online status:`, err);
    return { success: false, error: msg };
  }
}
