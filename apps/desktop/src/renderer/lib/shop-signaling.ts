/**
 * Shop-side WebRTC signaling handler.
 *
 * Listens on the Supabase Realtime Broadcast channel for WebRTC offers
 * from customers. For each offer, creates a peer connection, generates
 * an answer, and relays ICE candidates back through the same channel.
 */

import {
  joinSignalingChannel,
  broadcast,
  type SignalPayload,
} from "@printap/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ShopSession {
  sessionId: string;
  pc: RTCPeerConnection;
  channel: RealtimeChannel;
  dataChannel: RTCDataChannel | null;
}

/** Active sessions keyed by sessionId */
const sessions = new Map<string, ShopSession>();

/** STUN servers — free Google STUN for NAT traversal on LAN */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type FileReceivedCallback = (
  sessionId: string,
  fileBuffer: ArrayBuffer,
  fileName?: string
) => void;

export interface SignalingCallbacks {
  onSessionStart?: (sessionId: string) => void;
  onFileProgress?: (
    sessionId: string,
    fileName: string,
    pct: number,
    received: number,
    total: number
  ) => void;
  onFileReceived: FileReceivedCallback;
  onSessionError?: (sessionId: string, error: string) => void;
}

/**
 * Start listening for WebRTC offers on the given shop's signaling channel.
 */
export function startShopSignaling(
  shopId: string,
  callbacksOrHandler: FileReceivedCallback | SignalingCallbacks
): RealtimeChannel {
  const callbacks: SignalingCallbacks =
    typeof callbacksOrHandler === "function"
      ? { onFileReceived: callbacksOrHandler }
      : callbacksOrHandler;

  const channel = joinSignalingChannel(shopId);

  // Listen for new customer offers
  channel.on(
    "broadcast",
    { event: "webrtc-offer" },
    async ({ payload }: { payload: Record<string, unknown> }) => {
      const { sessionId, data } = payload as unknown as SignalPayload;
      console.log(`[shop] Received offer for session ${sessionId}`);
      callbacks.onSessionStart?.(sessionId);
      await handleOffer(
        channel,
        sessionId,
        data as RTCSessionDescriptionInit,
        callbacks
      );
    }
  );

  // Listen for remote ICE candidates
  channel.on(
    "broadcast",
    { event: "webrtc-ice" },
    async ({ payload }: { payload: Record<string, unknown> }) => {
      const { sessionId, data } = payload as unknown as SignalPayload;
      const session = sessions.get(sessionId);
      if (!session) return;

      try {
        await session.pc.addIceCandidate(
          new RTCIceCandidate(data as RTCIceCandidateInit)
        );
        console.log(`[shop] Added remote ICE candidate for ${sessionId}`);
      } catch (err) {
        console.error(`[shop] Failed to add ICE candidate:`, err);
      }
    }
  );

  console.log(`[shop] Signaling started for shop ${shopId}`);
  return channel;
}

/**
 * Stop signaling and cleanup active connections.
 */
export function stopShopSignaling(channel: RealtimeChannel | null): void {
  if (channel) {
    try {
      channel.unsubscribe();
    } catch (e) {
      console.error("[shop] Error unsubscribing channel:", e);
    }
  }
  for (const sessionId of Array.from(sessions.keys())) {
    cleanup(sessionId);
  }
}

/**
 * Handle an incoming WebRTC offer: create peer connection, answer, and
 * set up the DataChannel listener.
 */
async function handleOffer(
  channel: RealtimeChannel,
  sessionId: string,
  offer: RTCSessionDescriptionInit,
  callbacks: SignalingCallbacks
): Promise<void> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  const session: ShopSession = {
    sessionId,
    pc,
    channel,
    dataChannel: null,
  };
  sessions.set(sessionId, session);

  // Relay our ICE candidates to the customer
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      broadcast(channel, "webrtc-ice", {
        sessionId,
        data: event.candidate.toJSON(),
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[shop] Connection state: ${pc.connectionState}`);
    if (
      pc.connectionState === "disconnected" ||
      pc.connectionState === "failed"
    ) {
      if (pc.connectionState === "failed") {
        callbacks.onSessionError?.(sessionId, "WebRTC peer connection failed");
      }
      cleanup(sessionId);
    }
  };

  // The customer creates the DataChannel; we listen for it here.
  pc.ondatachannel = (event) => {
    console.log(`[shop] DataChannel received: ${event.channel.label}`);
    session.dataChannel = event.channel;
    setupDataChannelReceiver(session, callbacks);
  };

  try {
    // Set remote offer and create answer
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Send answer back to customer via broadcast
    await broadcast(channel, "webrtc-answer", {
      sessionId,
      data: answer,
    });

    console.log(`[shop] Sent answer for session ${sessionId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[shop] Failed to negotiate answer:`, err);
    callbacks.onSessionError?.(sessionId, msg);
    cleanup(sessionId);
  }
}

/**
 * Set up the DataChannel to receive file chunks.
 * Protocol:
 *   - First message: JSON metadata { fileName, fileSize, totalChunks }
 *   - Subsequent messages: ArrayBuffer chunks (64KB each)
 *   - Last message: string "EOF"
 */
function setupDataChannelReceiver(
  session: ShopSession,
  callbacks: SignalingCallbacks
): void {
  const dc = session.dataChannel!;
  dc.binaryType = "arraybuffer";

  let chunks: ArrayBuffer[] = [];
  let expectedSize = 0;
  let receivedSize = 0;
  let metadata: { fileName: string; fileSize: number; totalChunks: number } | null = null;

  dc.onmessage = (event) => {
    // String messages: metadata or EOF
    if (typeof event.data === "string") {
      if (event.data === "EOF") {
        console.log(
          `[shop] Transfer complete: ${receivedSize}/${expectedSize} bytes`
        );
        // Assemble the file
        const assembled = new Uint8Array(receivedSize);
        let offset = 0;
        for (const chunk of chunks) {
          assembled.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
        const fileName = metadata?.fileName;
        callbacks.onFileReceived(session.sessionId, assembled.buffer, fileName);

        // Clean up
        chunks = [];
        metadata = null;
        receivedSize = 0;
      } else {
        // Parse metadata
        try {
          metadata = JSON.parse(event.data);
          expectedSize = metadata?.fileSize || 0;
          console.log(`[shop] File metadata:`, metadata);
          if (metadata) {
            callbacks.onFileProgress?.(
              session.sessionId,
              metadata.fileName,
              0,
              0,
              expectedSize
            );
          }
        } catch (err) {
          console.error(`[shop] Failed to parse metadata:`, err);
        }
      }
      return;
    }

    // Binary message: file chunk
    const chunk = event.data as ArrayBuffer;
    chunks.push(chunk);
    receivedSize += chunk.byteLength;

    if (metadata && expectedSize > 0) {
      const pct = Math.min(100, Math.round((receivedSize / expectedSize) * 100));
      callbacks.onFileProgress?.(
        session.sessionId,
        metadata.fileName,
        pct,
        receivedSize,
        expectedSize
      );
    }
  };

  dc.onopen = () => {
    console.log(`[shop] DataChannel open for session ${session.sessionId}`);
  };

  dc.onclose = () => {
    console.log(`[shop] DataChannel closed for session ${session.sessionId}`);
  };

  dc.onerror = (err) => {
    console.error(`[shop] DataChannel error:`, err);
    callbacks.onSessionError?.(
      session.sessionId,
      "DataChannel encountered an error"
    );
  };
}

/** Cleanup a completed or failed session. */
function cleanup(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    session.dataChannel?.close();
    session.pc.close();
  } catch (e) {
    // Ignore close errors
  }
  sessions.delete(sessionId);
  console.log(`[shop] Session ${sessionId} cleaned up`);
}
