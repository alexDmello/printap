import {
  getSupabase,
  presenceChannelName,
  setShopOnline,
  HEARTBEAT_INTERVAL_MS,
} from "@printap/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";

let currentChannel: RealtimeChannel | null = null;
let currentShopId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let transitionPromise: Promise<void> | null = null;

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

export async function startPresence(
  shopId: string,
  onStatusChange?: StatusListener
): Promise<{ success: boolean; error?: string }> {
  if (onStatusChange) {
    listeners.add(onStatusChange);
  }

  if (transitionPromise) {
    await transitionPromise;
  }

  if (isRunning && currentShopId === shopId && currentChannel) {
    return { success: true };
  }

  if (isRunning) {
    await stopPresence();
  }

  currentShopId = shopId;
  isRunning = true;
  notifyStatus("connecting", "Connecting to presence channel...");

  try {
    if (window.electronAPI?.setActiveShopId) {
      await window.electronAPI.setActiveShopId(shopId);
    }

    const dbResult = await setShopOnline(shopId, true);
    if (!dbResult.success) {
      console.warn("[presence] Initial DB mark online warning:", dbResult.error);
    }

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
            notifyStatus("online", "Shop is online and broadcasting presence");
          } catch (trackErr) {
            console.error("[presence] Failed to track presence:", trackErr);
            notifyStatus("online", "Subscribed with tracking warning");
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          notifyStatus("error", `Presence channel status: ${status}`);
        }
      });

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      if (!isRunning || !currentShopId) return;
      try {
        if (currentChannel && currentChannel.state === "joined") {
          await currentChannel.track({
            shopId: currentShopId,
            timestamp: new Date().toISOString(),
            isOnline: true,
          });
        }
        await setShopOnline(currentShopId, true);
      } catch (hbErr) {
        console.warn("[presence] Heartbeat tick error:", hbErr);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    isRunning = false;
    notifyStatus("error", errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function stopPresence(): Promise<void> {
  if (transitionPromise) {
    await transitionPromise;
  }

  transitionPromise = (async () => {
    const shopId = currentShopId;
    isRunning = false;
    currentShopId = null;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (currentChannel) {
      const ch = currentChannel;
      currentChannel = null;
      try {
        await ch.untrack();
        await ch.unsubscribe();
        const supabase = getSupabase();
        await supabase.removeChannel(ch);
      } catch (e) {
        console.warn("[presence] Error closing presence channel:", e);
      }
    }

    if (shopId) {
      try {
        if (window.electronAPI?.setActiveShopId) {
          await window.electronAPI.setActiveShopId(null);
        }
        await setShopOnline(shopId, false);
      } catch (e) {
        console.warn("[presence] Error setting shop offline in DB:", e);
      }
    }

    notifyStatus("disconnected", "Shop is offline");
  })();

  try {
    await transitionPromise;
  } finally {
    transitionPromise = null;
  }
}
