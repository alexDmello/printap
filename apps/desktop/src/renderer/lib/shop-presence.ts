import {
  getSupabase,
  presenceChannelName,
  setShopOnline,
  HEARTBEAT_INTERVAL_MS,
} from "@printap/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";

let currentChannel: RealtimeChannel | null = null;
let currentShopId: string | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let isRunning = false;

export type PresenceConnectionStatus =
  | "disconnected"
  | "connecting"
  | "online"
  | "error";

type StatusListener = (status: PresenceConnectionStatus, detail?: string) => void;
const listeners = new Set<StatusListener>();

export function subscribePresenceStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyStatus(status: PresenceConnectionStatus, detail?: string) {
  for (const listener of listeners) {
    try {
      listener(status, detail);
    } catch (e) {
      console.error("[presence] Listener error:", e);
    }
  }
}

export function isPresenceActive(): boolean {
  return isRunning && currentChannel !== null;
}

export function getCurrentPresenceShopId(): string | null {
  return currentShopId;
}

/**
 * Starts the shop presence system:
 * 1. Sets is_online = true in Supabase database
 * 2. Joins the presence channel for this shop
 * 3. Tracks presence payload
 * 4. Schedules recurring 30s heartbeat to update DB and re-track
 * 5. Informs Electron main process of active shop ID
 */
export async function startPresence(
  shopId: string,
  onStatusChange?: StatusListener
): Promise<{ success: boolean; error?: string }> {
  if (onStatusChange) {
    listeners.add(onStatusChange);
  }

  // If already running for this shop, return early
  if (isRunning && currentShopId === shopId && currentChannel) {
    return { success: true };
  }

  // If running for another shop, clean up first
  if (isRunning) {
    await stopPresence();
  }

  currentShopId = shopId;
  isRunning = true;
  notifyStatus("connecting", "Connecting to presence channel...");

  try {
    // Notify Electron main process
    if (window.electronAPI?.setActiveShopId) {
      window.electronAPI.setActiveShopId(shopId);
    }

    // 1. Mark online in database immediately
    const dbResult = await setShopOnline(shopId, true);
    if (!dbResult.success) {
      console.warn("[presence] Initial DB mark online warning:", dbResult.error);
    }

    // 2. Join Presence Channel
    const supabase = getSupabase();
    const chName = presenceChannelName(shopId);

    const channel = supabase.channel(chName, {
      config: {
        presence: {
          key: shopId,
        },
      },
    });

    currentChannel = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        console.log(`[presence] Channel synced for shop ${shopId}`);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.track({
              shopId,
              timestamp: new Date().toISOString(),
              isOnline: true,
            });
            console.log(`[presence] Subscribed & tracking for shop ${shopId}`);
            notifyStatus("online", "Shop is online and broadcasting presence");
          } catch (trackErr) {
            console.error("[presence] Failed to track presence:", trackErr);
            notifyStatus("online", "Subscribed with tracking warning");
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[presence] Channel status: ${status}`);
          notifyStatus("error", `Presence channel status: ${status}`);
        } else if (status === "CLOSED") {
          console.log(`[presence] Channel closed`);
        }
      });

    // 3. Start Heartbeat Loop (every 30s)
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      if (!isRunning || !currentShopId) return;

      try {
        // Re-track presence in channel
        if (currentChannel) {
          await currentChannel.track({
            shopId: currentShopId,
            timestamp: new Date().toISOString(),
            isOnline: true,
          });
        }

        // Heartbeat in DB (last_seen_at + is_online = true)
        await setShopOnline(currentShopId, true);
      } catch (hbErr) {
        console.warn("[presence] Heartbeat tick error:", hbErr);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[presence] Failed to start presence:", err);
    isRunning = false;
    notifyStatus("error", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Stops the presence system:
 * 1. Clears heartbeat timer
 * 2. Untracks and leaves presence channel
 * 3. Sets is_online = false in DB
 * 4. Clears active shop in Electron main
 */
export async function stopPresence(): Promise<void> {
  const shopId = currentShopId;
  isRunning = false;
  currentShopId = null;

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (currentChannel) {
    try {
      await currentChannel.untrack();
      await currentChannel.unsubscribe();
      const supabase = getSupabase();
      supabase.removeChannel(currentChannel);
    } catch (e) {
      console.warn("[presence] Error closing presence channel:", e);
    }
    currentChannel = null;
  }

  if (shopId) {
    try {
      if (window.electronAPI?.setActiveShopId) {
        window.electronAPI.setActiveShopId(null);
      }
      if (window.electronAPI?.setShopOffline) {
        await window.electronAPI.setShopOffline(shopId);
      } else {
        await setShopOnline(shopId, false);
      }
    } catch (e) {
      console.warn("[presence] Error setting shop offline in DB:", e);
    }
  }

  notifyStatus("disconnected", "Shop is offline");
}
