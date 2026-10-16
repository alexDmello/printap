/**
 * Shop-side WebRTC signaling handler.
 *
 * Listens on the Supabase Realtime Broadcast channel for WebRTC offers
 * from customers. For each offer, creates a peer connection, generates
 * an answer, and relays ICE candidates back through the same channel.
 *
 * Supports both legacy single-file transfers and rich multi-file orders
 * with print settings, token codes, and pickup PINs.
 */

import {
  joinSignalingChannel,
  broadcast,
  DEFAULT_ICE_SERVERS,
  waitForIceGathering,
  type SignalPayload,
  type PrintSettings,
  type TransferManifestOrder,
  type TransferFileHeaderMessage,
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

/** Early remote ICE candidates buffered before remoteDescription is set */
const earlyCandidates = new Map<string, RTCIceCandidateInit[]>();
const earlyCandidateTimers = new Map<string, ReturnType<typeof setTimeout>>();
const sessionInactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();

function resetSessionTimeout(sessionId: string, timeoutMs = 90_000): void {
  const existing = sessionInactivityTimers.get(sessionId);
  if (existing) clearTimeout(existing);
  sessionInactivityTimers.set(
    sessionId,
    setTimeout(() => {
      console.log(`[shop] Session ${sessionId} timed out due to inactivity`);
      cleanup(sessionId);
    }, timeoutMs)
  );
}

export interface ReceivedOrderFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  settings: PrintSettings;
  buffer: ArrayBuffer;
}

export interface ReceivedOrder {
  sessionId: string;
  order: TransferManifestOrder;
  files: ReceivedOrderFile[];
}

export type FileReceivedCallback = (
  sessionId: string,
  fileBuffer: ArrayBuffer,
  fileName?: string
) => void;

export type OrderReceivedCallback = (order: ReceivedOrder) => void;

export interface SignalingCallbacks {
  onSessionStart?: (sessionId: string) => void;
  onRequestToken?: (
    sessionId: string,
    hasColor: boolean,
    totalAmount?: number,
    fileCount?: number
  ) => void;
  onFileProgress?: (
    sessionId: string,
    fileName: string,
    pct: number,
    received: number,
    total: number,
    fileIndex?: number,
    totalFiles?: number
  ) => void;
  onFileReceived: FileReceivedCallback;
  onManifestReceived?: (sessionId: string, order: TransferManifestOrder) => void;
  onOrderReceived?: OrderReceivedCallback;
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
      const candidateInit = data as RTCIceCandidateInit;
      if (!candidateInit || !candidateInit.candidate) return;
      const session = sessions.get(sessionId);

      // Buffer candidate if session doesn't exist yet or remote description isn't set
      if (!session || !session.pc.remoteDescription) {
        if (!earlyCandidates.has(sessionId)) {
          earlyCandidates.set(sessionId, []);
        }
        earlyCandidates.get(sessionId)!.push(candidateInit);
        if (!earlyCandidateTimers.has(sessionId)) {
          earlyCandidateTimers.set(
            sessionId,
            setTimeout(() => {
              earlyCandidates.delete(sessionId);
              earlyCandidateTimers.delete(sessionId);
              console.log(`[shop] Cleaned up abandoned early ICE candidates for ${sessionId}`);
            }, 60_000)
          );
        }
        console.log(`[shop] Buffered early ICE candidate for ${sessionId}`);
        return;
      }

      try {
        await session.pc.addIceCandidate(
          new RTCIceCandidate(candidateInit)
        );
        console.log(`[shop] Added remote ICE candidate for ${sessionId}`);
      } catch (err) {
        console.error(`[shop] Failed to add ICE candidate:`, err);
      }
    }
  );

  // Listen for customer token allocation requests (zero-db local atomic tokens)
  channel.on(
    "broadcast",
    { event: "request-token" },
    ({ payload }: { payload: Record<string, unknown> }) => {
      const { sessionId, hasColor, totalAmount, fileCount } =
        payload as unknown as SignalPayload;
      console.log(
        `[shop] Received request-token for session ${sessionId} (hasColor: ${hasColor})`
      );
      callbacks.onRequestToken?.(sessionId, Boolean(hasColor), totalAmount, fileCount);
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
  for (const timer of earlyCandidateTimers.values()) {
    clearTimeout(timer);
  }
  earlyCandidateTimers.clear();
  earlyCandidates.clear();

  for (const timer of sessionInactivityTimers.values()) {
    clearTimeout(timer);
  }
  sessionInactivityTimers.clear();

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
  const existing = sessions.get(sessionId);
  if (existing) {
    console.log(
      `[shop] Session ${sessionId} already exists (state: ${existing.pc.connectionState}, signaling: ${existing.pc.signalingState})`
    );
    if (
      existing.pc.connectionState === "connected" ||
      existing.pc.connectionState === "connecting" ||
      existing.pc.signalingState === "stable"
    ) {
      if (existing.pc.localDescription) {
        console.log(`[shop] Re-transmitting existing answer for session ${sessionId}`);
        const localDesc = existing.pc.localDescription;
        await broadcast(channel, "webrtc-answer", {
          sessionId,
          data: { type: localDesc.type, sdp: localDesc.sdp },
        });
      }
      return;
    } else {
      cleanup(sessionId);
    }
  }

  resetSessionTimeout(sessionId);

  const pc = new RTCPeerConnection({
    iceServers: DEFAULT_ICE_SERVERS,
    iceCandidatePoolSize: 10,
  });

  const session: ShopSession = {
    sessionId,
    pc,
    channel,
    dataChannel: null,
  };
  sessions.set(sessionId, session);

  // Relay our ICE candidates to the customer
  pc.onicecandidate = (event) => {
    if (event.candidate && event.candidate.candidate) {
      broadcast(channel, "webrtc-ice", {
        sessionId,
        data: event.candidate.toJSON(),
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(
      `[shop] Connection state: ${pc.connectionState} (ice: ${pc.iceConnectionState})`
    );
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      callbacks.onSessionError?.(sessionId, "WebRTC peer connection closed or failed");
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

    // Drain any buffered early ICE candidates now that remote description is set
    const buffered = earlyCandidates.get(sessionId);
    if (buffered && buffered.length > 0) {
      console.log(`[shop] Draining ${buffered.length} early ICE candidates for ${sessionId}`);
      for (const cand of buffered) {
        try {
          if (cand && cand.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        } catch (e) {
          console.warn(`[shop] Failed to add early ICE candidate:`, e);
        }
      }
      earlyCandidates.delete(sessionId);
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait up to 800ms for initial host (LAN) and STUN candidates to be gathered
    await waitForIceGathering(pc, 800);

    const localAnswer = pc.localDescription || answer;

    // Send answer back to customer via broadcast
    await broadcast(channel, "webrtc-answer", {
      sessionId,
      data: { type: localAnswer.type, sdp: localAnswer.sdp },
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
 * Set up the DataChannel to receive multi-file orders and file chunks.
 */
function setupDataChannelReceiver(
  session: ShopSession,
  callbacks: SignalingCallbacks
): void {
  const dc = session.dataChannel!;
  dc.binaryType = "arraybuffer";

  let manifest: TransferManifestOrder | null = null;
  const receivedFiles: ReceivedOrderFile[] = [];

  let currentFileHeader: TransferFileHeaderMessage | null = null;
  let chunks: ArrayBuffer[] = [];
  let expectedSize = 0;
  let receivedSize = 0;
  let legacyMetadata: { fileName: string; fileSize: number; totalChunks: number } | null = null;

  dc.onmessage = (event) => {
    resetSessionTimeout(session.sessionId);
    // String messages: JSON messages or EOF
    if (typeof event.data === "string") {
      // 1. Check for legacy plain EOF
      if (event.data === "EOF") {
        if (chunks.length > 0) {
          const assembled = new Uint8Array(receivedSize);
          let offset = 0;
          for (const chunk of chunks) {
            assembled.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }

          const fileName =
            currentFileHeader?.fileName ||
            legacyMetadata?.fileName ||
            `file_${receivedFiles.length + 1}`;

          if (currentFileHeader) {
            const alreadyPushed = receivedFiles.some(
              (f) => f.fileId === currentFileHeader!.fileId
            );
            if (!alreadyPushed) {
              receivedFiles.push({
                fileId: currentFileHeader.fileId,
                fileName: currentFileHeader.fileName,
                fileSize: currentFileHeader.fileSize,
                pageCount: currentFileHeader.pageCount,
                settings: currentFileHeader.settings,
                buffer: assembled.buffer,
              });
            }
          }

          // Trigger single-file callback ONLY if NOT part of a structured order manifest!
          if (!manifest) {
            callbacks.onFileReceived(session.sessionId, assembled.buffer, fileName);
          }

          chunks = [];
          receivedSize = 0;
          legacyMetadata = null;
        }
        return;
      }

      // 2. Parse JSON
      try {
        const msg = JSON.parse(event.data);

        // Case A: Order Manifest
        if (msg.type === "order-manifest") {
          console.log(`[shop] Order manifest received:`, msg);
          manifest = msg.order;
          callbacks.onManifestReceived?.(session.sessionId, msg.order);
          return;
        }

        // Case B: File Header
        if (msg.type === "file-header") {
          console.log(`[shop] File header received:`, msg);
          
          // SECURITY: Enforce maximum file size of 100MB to prevent Memory Exhaustion (DoS)
          if (msg.fileSize > 100 * 1024 * 1024) {
             callbacks.onSessionError?.(session.sessionId, "Security Exception: File size exceeds 100MB limit.");
             cleanup(session.sessionId);
             return;
          }

          currentFileHeader = msg as TransferFileHeaderMessage;
          expectedSize = currentFileHeader.fileSize;
          receivedSize = 0;
          chunks = [];
          callbacks.onFileProgress?.(
            session.sessionId,
            currentFileHeader.fileName,
            0,
            0,
            expectedSize,
            receivedFiles.length + 1,
            manifest?.totalFiles ?? 1
          );
          return;
        }

        // Case C: File EOF
        if (msg.type === "file-eof") {
          console.log(`[shop] File EOF received for ${msg.fileId}`);
          if (currentFileHeader && chunks.length > 0) {
            const assembled = new Uint8Array(receivedSize);
            let offset = 0;
            for (const chunk of chunks) {
              assembled.set(new Uint8Array(chunk), offset);
              offset += chunk.byteLength;
            }

            const alreadyPushed = receivedFiles.some(
              (f) => f.fileId === currentFileHeader!.fileId
            );
            if (!alreadyPushed) {
              receivedFiles.push({
                fileId: currentFileHeader.fileId,
                fileName: currentFileHeader.fileName,
                fileSize: currentFileHeader.fileSize,
                pageCount: currentFileHeader.pageCount,
                settings: currentFileHeader.settings,
                buffer: assembled.buffer,
              });
            }

            // Only call legacy onFileReceived if NOT part of a structured order manifest!
            if (!manifest) {
              callbacks.onFileReceived(
                session.sessionId,
                assembled.buffer,
                currentFileHeader.fileName
              );
            }
            chunks = [];
            receivedSize = 0;
          }
          return;
        }

        // Case D: Order Complete
        if (msg.type === "order-complete") {
          console.log(
            `[shop] Order complete received! Total files: ${receivedFiles.length}`
          );
          if (manifest && callbacks.onOrderReceived) {
            callbacks.onOrderReceived({
              sessionId: session.sessionId,
              order: manifest,
              files: receivedFiles,
            });
          }
          return;
        }

        // Case E: Legacy metadata { fileName, fileSize, totalChunks }
        if (msg.fileName && typeof msg.fileSize === "number") {
          // SECURITY: Enforce maximum file size of 100MB to prevent Memory Exhaustion (DoS)
          if (msg.fileSize > 100 * 1024 * 1024) {
             callbacks.onSessionError?.(session.sessionId, "Security Exception: File size exceeds 100MB limit.");
             cleanup(session.sessionId);
             return;
          }

          legacyMetadata = msg;
          expectedSize = msg.fileSize;
          receivedSize = 0;
          chunks = [];
          callbacks.onFileProgress?.(
            session.sessionId,
            msg.fileName,
            0,
            0,
            expectedSize,
            1,
            1
          );
          return;
        }
      } catch (err) {
        console.error(`[shop] Failed to parse message on DataChannel:`, err);
      }
      return;
    }

    // Binary message: file chunk
    const chunk = event.data as ArrayBuffer;
    chunks.push(chunk);
    receivedSize += chunk.byteLength;

    const currentName =
      currentFileHeader?.fileName ||
      legacyMetadata?.fileName ||
      "receiving...";

    if (expectedSize > 0) {
      const pct = Math.min(
        100,
        Math.round((receivedSize / expectedSize) * 100)
      );
      callbacks.onFileProgress?.(
        session.sessionId,
        currentName,
        pct,
        receivedSize,
        expectedSize,
        receivedFiles.length + 1,
        manifest?.totalFiles ?? 1
      );
    }
  };

  dc.onopen = () => {
    console.log(`[shop] DataChannel open for session ${session.sessionId}`);
  };

  dc.onclose = () => {
    console.log(`[shop] DataChannel closed for session ${session.sessionId}`);
    setTimeout(() => {
      cleanup(session.sessionId);
    }, 5000);
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
  const earlyTimer = earlyCandidateTimers.get(sessionId);
  if (earlyTimer) {
    clearTimeout(earlyTimer);
    earlyCandidateTimers.delete(sessionId);
  }
  earlyCandidates.delete(sessionId);

  const inactivityTimer = sessionInactivityTimers.get(sessionId);
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    sessionInactivityTimers.delete(sessionId);
  }

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

/** Broadcast payment confirmation event to the customer. */
export async function broadcastPaymentConfirmed(
  channel: RealtimeChannel,
  sessionId: string,
  tokenCode?: string
): Promise<void> {
  await broadcast(channel, "payment-confirmed", {
    sessionId,
    tokenCode,
    confirmedAt: new Date().toISOString(),
  });
}

/** Broadcast order/queue status to customer. */
export async function broadcastOrderStatus(
  channel: RealtimeChannel,
  payload: {
    sessionId: string;
    tokenCode?: string;
    queuePosition?: number;
    printerNumber?: number;
    paymentStatus?: string;
    status?: string;
    errorDetail?: string;
  }
): Promise<void> {
  await broadcast(channel, "order-status", payload);
}

/** Broadcast locally allocated authoritative token to customer. */
export async function broadcastTokenAssigned(
  channel: RealtimeChannel,
  payload: {
    sessionId: string;
    tokenCode: string;
    queuePosition?: number;
    printerNumber?: number;
  }
): Promise<void> {
  await broadcast(channel, "assign-token", payload);
}

