import {
  joinSignalingChannel,
  leaveSignalingChannel,
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

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB hard cap per file
const MAX_ORDER_TOTAL_BYTES = 250 * 1024 * 1024; // 250MB hard cap per order
const PROGRESS_THROTTLE_MS = 100; // Max 10 UI updates per second

const sessions = new Map<string, ShopSession>();
const earlyCandidates = new Map<string, RTCIceCandidateInit[]>();
const earlyCandidateTimers = new Map<string, ReturnType<typeof setTimeout>>();
const sessionInactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();

let activeSignalingShopId: string | null = null;

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

export function startShopSignaling(
  shopId: string,
  callbacksOrHandler: FileReceivedCallback | SignalingCallbacks
): RealtimeChannel {
  const callbacks: SignalingCallbacks =
    typeof callbacksOrHandler === "function"
      ? { onFileReceived: callbacksOrHandler }
      : callbacksOrHandler;

  activeSignalingShopId = shopId;
  const channel = joinSignalingChannel(shopId, true);

  channel.on(
    "broadcast",
    { event: "webrtc-offer" },
    async ({ payload }: { payload: Record<string, unknown> }) => {
      const { sessionId, data } = payload as unknown as SignalPayload;
      if (!sessionId || !data) return;
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

  channel.on(
    "broadcast",
    { event: "webrtc-ice" },
    async ({ payload }: { payload: Record<string, unknown> }) => {
      const { sessionId, data } = payload as unknown as SignalPayload;
      const candidateInit = data as RTCIceCandidateInit;
      if (!sessionId || !candidateInit || !candidateInit.candidate) return;
      const session = sessions.get(sessionId);

      if (!session || !session.pc.remoteDescription) {
        if (!earlyCandidates.has(sessionId)) {
          earlyCandidates.set(sessionId, []);
        }
        const queue = earlyCandidates.get(sessionId)!;
        if (queue.length < 50) {
          queue.push(candidateInit);
        }
        if (!earlyCandidateTimers.has(sessionId)) {
          earlyCandidateTimers.set(
            sessionId,
            setTimeout(() => {
              earlyCandidates.delete(sessionId);
              earlyCandidateTimers.delete(sessionId);
            }, 60_000)
          );
        }
        return;
      }

      try {
        await session.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (err) {
        console.error(`[shop] Failed to add ICE candidate:`, err);
      }
    }
  );

  channel.on(
    "broadcast",
    { event: "request-token" },
    ({ payload }: { payload: Record<string, unknown> }) => {
      const { sessionId, hasColor, totalAmount, fileCount } =
        payload as unknown as SignalPayload;
      if (!sessionId) return;
      callbacks.onRequestToken?.(
        sessionId,
        Boolean(hasColor),
        totalAmount,
        fileCount
      );
    }
  );

  channel.on(
    "broadcast",
    { event: "order-status" },
    ({ payload }: { payload: Record<string, unknown> }) => {
      const { sessionId, status, errorDetail } =
        payload as unknown as SignalPayload;
      if (!sessionId) return;
      if (status === "cancelled" || status === "error") {
        callbacks.onSessionError?.(
          sessionId,
          errorDetail || `Customer order was ${status}`
        );
        cleanup(sessionId);
      }
    }
  );

  console.log(`[shop] Signaling started for shop ${shopId}`);
  return channel;
}

export function stopShopSignaling(channel: RealtimeChannel | null): void {
  if (activeSignalingShopId) {
    leaveSignalingChannel(activeSignalingShopId).catch(() => {});
    activeSignalingShopId = null;
  } else if (channel) {
    try {
      channel.unsubscribe();
    } catch {}
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

async function handleOffer(
  channel: RealtimeChannel,
  sessionId: string,
  offer: RTCSessionDescriptionInit,
  callbacks: SignalingCallbacks
): Promise<void> {
  const existing = sessions.get(sessionId);
  if (existing) {
    if (
      existing.pc.connectionState === "connected" ||
      existing.pc.connectionState === "connecting" ||
      existing.pc.signalingState === "stable"
    ) {
      if (existing.pc.localDescription) {
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

  pc.onicecandidate = (event) => {
    if (event.candidate && event.candidate.candidate) {
      broadcast(channel, "webrtc-ice", {
        sessionId,
        data: event.candidate.toJSON(),
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      callbacks.onSessionError?.(
        sessionId,
        "WebRTC peer connection closed or failed"
      );
      cleanup(sessionId);
    }
  };

  pc.ondatachannel = (event) => {
    session.dataChannel = event.channel;
    setupDataChannelReceiver(session, callbacks);
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const buffered = earlyCandidates.get(sessionId);
    if (buffered && buffered.length > 0) {
      for (const cand of buffered) {
        try {
          if (cand && cand.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        } catch {}
      }
      earlyCandidates.delete(sessionId);
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc, 800);

    const localAnswer = pc.localDescription || answer;
    await broadcast(channel, "webrtc-answer", {
      sessionId,
      data: { type: localAnswer.type, sdp: localAnswer.sdp },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onSessionError?.(sessionId, msg);
    cleanup(sessionId);
  }
}

function setupDataChannelReceiver(
  session: ShopSession,
  callbacks: SignalingCallbacks
): void {
  const dc = session.dataChannel!;
  dc.binaryType = "arraybuffer";

  let manifest: TransferManifestOrder | null = null;
  const receivedFiles: ReceivedOrderFile[] = [];
  let orderTotalBytesReceived = 0;

  let currentFileHeader: TransferFileHeaderMessage | null = null;
  let legacyMetadata: { fileName: string; fileSize: number; totalChunks: number } | null = null;

  let assemblyBuffer: Uint8Array | null = null;
  let expectedSize = 0;
  let receivedSize = 0;
  let lastProgressEmitTime = 0;

  const finalizeCurrentFile = (): ArrayBuffer | null => {
    if (!assemblyBuffer || receivedSize === 0) return null;
    const rawBuffer = assemblyBuffer.buffer as ArrayBuffer;
    const finalBuffer =
      receivedSize === assemblyBuffer.byteLength
        ? rawBuffer
        : rawBuffer.slice(0, receivedSize);
    assemblyBuffer = null;
    return finalBuffer;
  };

  dc.onmessage = (event) => {
    resetSessionTimeout(session.sessionId);

    if (typeof event.data === "string") {
      if (event.data === "EOF") {
        const finalBuf = finalizeCurrentFile();
        if (finalBuf) {
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
                fileSize: finalBuf.byteLength,
                pageCount: currentFileHeader.pageCount,
                settings: currentFileHeader.settings,
                buffer: finalBuf,
              });
            }
          }

          if (!manifest) {
            callbacks.onFileReceived(session.sessionId, finalBuf, fileName);
          }

          receivedSize = 0;
          expectedSize = 0;
          legacyMetadata = null;
        }
        return;
      }

      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "order-manifest") {
          manifest = msg.order;
          callbacks.onManifestReceived?.(session.sessionId, msg.order);
          return;
        }

        if (msg.type === "file-header") {
          if (
            typeof msg.fileSize !== "number" ||
            msg.fileSize <= 0 ||
            msg.fileSize > MAX_FILE_SIZE_BYTES
          ) {
            callbacks.onSessionError?.(
              session.sessionId,
              "Security Exception: File size invalid or exceeds 100MB limit."
            );
            cleanup(session.sessionId);
            return;
          }

          currentFileHeader = msg as TransferFileHeaderMessage;
          expectedSize = currentFileHeader.fileSize;
          receivedSize = 0;
          assemblyBuffer = new Uint8Array(expectedSize);
          lastProgressEmitTime = 0;

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

        if (msg.type === "file-eof") {
          const finalBuf = finalizeCurrentFile();
          if (currentFileHeader && finalBuf) {
            const alreadyPushed = receivedFiles.some(
              (f) => f.fileId === currentFileHeader!.fileId
            );
            if (!alreadyPushed) {
              receivedFiles.push({
                fileId: currentFileHeader.fileId,
                fileName: currentFileHeader.fileName,
                fileSize: finalBuf.byteLength,
                pageCount: currentFileHeader.pageCount,
                settings: currentFileHeader.settings,
                buffer: finalBuf,
              });
            }

            if (!manifest) {
              callbacks.onFileReceived(
                session.sessionId,
                finalBuf,
                currentFileHeader.fileName
              );
            }
          }
          receivedSize = 0;
          expectedSize = 0;
          return;
        }

        if (msg.type === "order-complete") {
          if (manifest && callbacks.onOrderReceived) {
            callbacks.onOrderReceived({
              sessionId: session.sessionId,
              order: manifest,
              files: receivedFiles,
            });
          }
          return;
        }

        if (msg.fileName && typeof msg.fileSize === "number") {
          if (msg.fileSize <= 0 || msg.fileSize > MAX_FILE_SIZE_BYTES) {
            callbacks.onSessionError?.(
              session.sessionId,
              "Security Exception: File size exceeds 100MB limit."
            );
            cleanup(session.sessionId);
            return;
          }

          legacyMetadata = msg;
          expectedSize = msg.fileSize;
          receivedSize = 0;
          assemblyBuffer = new Uint8Array(expectedSize);
          lastProgressEmitTime = 0;

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

    const chunk = event.data as ArrayBuffer;
    const chunkBytes = chunk.byteLength;

    orderTotalBytesReceived += chunkBytes;
    if (
      !assemblyBuffer ||
      receivedSize + chunkBytes > expectedSize ||
      orderTotalBytesReceived > MAX_ORDER_TOTAL_BYTES
    ) {
      callbacks.onSessionError?.(
        session.sessionId,
        "Security Exception: Binary stream overflowed declared file header size."
      );
      assemblyBuffer = null;
      cleanup(session.sessionId);
      return;
    }

    assemblyBuffer.set(new Uint8Array(chunk), receivedSize);
    receivedSize += chunkBytes;

    const now = performance.now();
    if (
      expectedSize > 0 &&
      (now - lastProgressEmitTime >= PROGRESS_THROTTLE_MS ||
        receivedSize === expectedSize)
    ) {
      lastProgressEmitTime = now;
      const currentName =
        currentFileHeader?.fileName ||
        legacyMetadata?.fileName ||
        "receiving...";
      const pct = Math.min(100, Math.round((receivedSize / expectedSize) * 100));
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

  dc.onclose = () => {
    assemblyBuffer = null;
    setTimeout(() => {
      cleanup(session.sessionId);
    }, 5000);
  };

  dc.onerror = () => {
    assemblyBuffer = null;
    callbacks.onSessionError?.(
      session.sessionId,
      "DataChannel encountered an error"
    );
  };
}

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
  } catch {}
  sessions.delete(sessionId);
}

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
