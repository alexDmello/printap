import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export type SignalEvent =
  | "webrtc-offer"
  | "webrtc-answer"
  | "webrtc-ice"
  | "payment-confirmed"
  | "order-status"
  | "request-token"
  | "assign-token";

export interface SignalPayload {
  sessionId: string;
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
  tokenCode?: string;
  queuePosition?: number;
  printerNumber?: number;
  paymentStatus?: string;
  status?: string;
  errorDetail?: string;
  confirmedAt?: string;
  hasColor?: boolean;
  totalAmount?: number;
  fileCount?: number;
}

export function channelName(shopId: string): string {
  return `signaling:${shopId}`;
}

const activeChannels = new Map<string, RealtimeChannel>();

/**
 * Cleanly removes and unsubscribes a cached signaling channel for `shopId`.
 */
export async function leaveSignalingChannel(shopId: string): Promise<void> {
  const existing = activeChannels.get(shopId);
  activeChannels.delete(shopId);
  if (existing) {
    try {
      const supabase = getSupabase();
      await existing.unsubscribe();
      await supabase.removeChannel(existing);
    } catch (err) {
      console.warn(`[signaling:${shopId}] Error removing channel:`, err);
    }
  }
}

/**
 * Joins or retrieves the cached signaling channel for `shopId`.
 * Guarantees a clean channel instance if `forceFresh` is true.
 */
export function joinSignalingChannel(
  shopId: string,
  forceFresh = false
): RealtimeChannel {
  const supabase = getSupabase();
  const existing = activeChannels.get(shopId);

  if (existing) {
    const state = existing.state;
    if (!forceFresh && (state === "joined" || state === "joining")) {
      return existing;
    }
    activeChannels.delete(shopId);
    try {
      existing.unsubscribe();
      supabase.removeChannel(existing);
    } catch {}
  }

  const channel = supabase.channel(channelName(shopId), {
    config: { broadcast: { self: false, ack: true } },
  });

  channel.subscribe((status) => {
    console.log(`[signaling:${shopId}] channel status → ${status}`);
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      if (activeChannels.get(shopId) === channel) {
        activeChannels.delete(shopId);
      }
    }
  });

  activeChannels.set(shopId, channel);
  return channel;
}

export async function waitForChannelReady(
  channel: RealtimeChannel,
  timeoutMs: number = 4000
): Promise<boolean> {
  if (channel.state === "joined") {
    return true;
  }
  if (channel.state === "closed" || channel.state === "errored") {
    return false;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const done = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      clearInterval(checkInterval);
      resolve(result);
    };

    const timer = setTimeout(() => {
      done(channel.state === "joined");
    }, timeoutMs);

    const checkInterval = setInterval(() => {
      if (channel.state === "joined") {
        done(true);
      } else if (channel.state === "closed" || channel.state === "errored") {
        done(false);
      }
    }, 40);
  });
}

export async function broadcast(
  channel: RealtimeChannel,
  event: SignalEvent,
  payload: SignalPayload
): Promise<boolean> {
  try {
    const isReady = await waitForChannelReady(channel, 2000);
    if (!isReady) {
      console.warn(`[signaling] Channel not ready for broadcast ${event}`);
      return false;
    }
    const res = await channel.send({
      type: "broadcast",
      event,
      payload,
    });
    if (res !== "ok") {
      console.warn(`[signaling] broadcast ${event} returned status:`, res);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[signaling] broadcast ${event} exception:`, err);
    return false;
  }
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export async function waitForIceGathering(
  pc: RTCPeerConnection,
  maxWaitMs: number = 800
): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
    };

    const check = () => {
      if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, maxWaitMs);

    pc.addEventListener("icegatheringstatechange", check);
  });
}
