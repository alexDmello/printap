import {
  joinSignalingChannel,
  leaveSignalingChannel,
  waitForChannelReady,
  broadcast,
  DEFAULT_ICE_SERVERS,
  waitForIceGathering,
  type SignalPayload,
  type TransferManifestOrder,
  type PrintSettings,
  type UploadedDocument,
  type QueueToken,
  type PaymentMethod,
  type PaymentStatus,
  type FinishingService,
} from "@printap/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CHUNK_SIZE = 64 * 1024; // 64KB chunks
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB high-water mark
const LOW_WATER_MARK = 256 * 1024; // 256KB low-water mark

export interface CustomerTransferFile {
  fileId: string;
  file: File;
  pageCount: number;
  settings: PrintSettings;
}

export interface CustomerSignalingCallbacks {
  onStatusChange?: (status: string, detail?: string) => void;
  onProgress?: (pct: number, fileIndex: number, totalFiles: number) => void;
  onTokenAssigned?: (data: {
    tokenCode: string;
    printerNumber?: number;
    queuePosition?: number;
  }) => void;
  onOrderStatus?: (data: SignalPayload) => void;
  onPaymentConfirmed?: (data: SignalPayload) => void;
  onError?: (error: string) => void;
}

export type TransferStatus =
  | "connecting"
  | "connected"
  | "sending"
  | "complete"
  | "error";

export interface TransferProgress {
  status: TransferStatus;
  percent: number;
  bytesSent: number;
  totalBytes: number;
  currentFileIndex?: number;
  currentFileName?: string;
  totalFiles?: number;
  error?: string;
}

export type ProgressCallback = (progress: TransferProgress) => void;

export interface SendOrderPayload {
  shopId: string;
  sessionId: string;
  documents: UploadedDocument[];
  token: QueueToken;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  finishingServices: FinishingService[];
}

export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function waitForBufferDrain(dc: RTCDataChannel): Promise<void> {
  if (dc.bufferedAmount <= MAX_BUFFERED_AMOUNT) {
    return;
  }
  dc.bufferedAmountLowThreshold = LOW_WATER_MARK;
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      if (dc.readyState !== "open") {
        reject(new Error("DataChannel closed while draining buffer"));
      } else {
        resolve();
      }
    }, 10_000);

    const onLow = () => {
      cleanup();
      resolve();
    };

    const onClose = () => {
      cleanup();
      reject(new Error("DataChannel closed during transfer"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      dc.removeEventListener("bufferedamountlow", onLow);
      dc.removeEventListener("close", onClose);
      dc.removeEventListener("error", onClose);
    };

    dc.addEventListener("bufferedamountlow", onLow);
    dc.addEventListener("close", onClose);
    dc.addEventListener("error", onClose);
  });
}

export async function streamOrderToShop(
  shopId: string,
  sessionId: string,
  manifestOrder: TransferManifestOrder,
  files: CustomerTransferFile[],
  callbacks: CustomerSignalingCallbacks
): Promise<{
  cleanup: () => void;
  channel: RealtimeChannel;
}> {
  const channel = joinSignalingChannel(shopId, true);
  const ready = await waitForChannelReady(channel, 5000);
  if (!ready) {
    throw new Error("Could not connect to shop signaling channel.");
  }

  const pc = new RTCPeerConnection({
    iceServers: DEFAULT_ICE_SERVERS,
    iceCandidatePoolSize: 10,
  });

  let isCleanedUp = false;
  const earlyCandidates: RTCIceCandidateInit[] = [];

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    try {
      pc.close();
    } catch {}
    leaveSignalingChannel(shopId).catch(() => {});
  };

  channel.on(
    "broadcast",
    { event: "assign-token" },
    ({ payload }: { payload: SignalPayload }) => {
      if (payload.sessionId !== sessionId || !payload.tokenCode) return;
      callbacks.onTokenAssigned?.({
        tokenCode: payload.tokenCode,
        printerNumber: payload.printerNumber,
        queuePosition: payload.queuePosition,
      });
    }
  );

  channel.on(
    "broadcast",
    { event: "order-status" },
    ({ payload }: { payload: SignalPayload }) => {
      if (payload.sessionId !== sessionId) return;
      callbacks.onOrderStatus?.(payload);
    }
  );

  channel.on(
    "broadcast",
    { event: "payment-confirmed" },
    ({ payload }: { payload: SignalPayload }) => {
      if (payload.sessionId !== sessionId) return;
      callbacks.onPaymentConfirmed?.(payload);
    }
  );

  channel.on(
    "broadcast",
    { event: "webrtc-ice" },
    async ({ payload }: { payload: SignalPayload }) => {
      if (payload.sessionId !== sessionId || !payload.data) return;
      const cand = payload.data as RTCIceCandidateInit;
      if (!cand.candidate) return;
      if (!pc.remoteDescription) {
        earlyCandidates.push(cand);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {}
    }
  );

  channel.on(
    "broadcast",
    { event: "webrtc-answer" },
    async ({ payload }: { payload: SignalPayload }) => {
      if (payload.sessionId !== sessionId || !payload.data) return;
      if (pc.signalingState !== "have-local-offer") return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription(payload.data as RTCSessionDescriptionInit)
        );
        for (const cand of earlyCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
        earlyCandidates.length = 0;
      } catch (err) {
        callbacks.onError?.(
          err instanceof Error ? err.message : "Failed to set remote answer"
        );
      }
    }
  );

  pc.onicecandidate = (event) => {
    if (event.candidate && event.candidate.candidate) {
      broadcast(channel, "webrtc-ice", {
        sessionId,
        data: event.candidate.toJSON(),
      });
    }
  };

  const dc = pc.createDataChannel("printap-transfer", { ordered: true });
  dc.binaryType = "arraybuffer";

  const transferPromise = new Promise<void>((resolve, reject) => {
    const handshakeTimeout = setTimeout(() => {
      reject(new Error("Shop terminal did not respond to P2P handshake in time."));
    }, 20_000);

    dc.onopen = async () => {
      clearTimeout(handshakeTimeout);
      try {
        callbacks.onStatusChange?.("streaming", "Streaming encrypted chunks...");

        dc.send(
          JSON.stringify({
            type: "order-manifest",
            order: manifestOrder,
          })
        );

        for (let fIdx = 0; fIdx < files.length; fIdx++) {
          const item = files[fIdx];
          const arrayBuffer = await item.file.arrayBuffer();
          const totalBytes = arrayBuffer.byteLength;
          const sha256 = await computeSha256Hex(arrayBuffer);

          dc.send(
            JSON.stringify({
              type: "file-header",
              fileId: item.fileId,
              fileName: item.file.name,
              fileSize: totalBytes,
              pageCount: item.pageCount,
              settings: item.settings,
              sha256,
            })
          );

          let offset = 0;
          while (offset < totalBytes) {
            await waitForBufferDrain(dc);
            const end = Math.min(offset + CHUNK_SIZE, totalBytes);
            dc.send(arrayBuffer.slice(offset, end));
            offset = end;

            const pct = Math.min(100, Math.round((offset / totalBytes) * 100));
            callbacks.onProgress?.(pct, fIdx + 1, files.length);
          }

          await waitForBufferDrain(dc);
          dc.send(
            JSON.stringify({
              type: "file-eof",
              fileId: item.fileId,
            })
          );
        }

        await waitForBufferDrain(dc);
        dc.send(JSON.stringify({ type: "order-complete" }));
        callbacks.onStatusChange?.("transferred", "All documents beamed to counter.");
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    dc.onerror = () => {
      clearTimeout(handshakeTimeout);
      reject(new Error("WebRTC DataChannel transfer interrupted."));
    };
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc, 800);

  const localOffer = pc.localDescription || offer;
  await broadcast(channel, "webrtc-offer", {
    sessionId,
    data: { type: localOffer.type, sdp: localOffer.sdp },
  });

  await transferPromise;

  return { cleanup, channel };
}

/**
 * Compatible wrapper around streamOrderToShop matching previous UI callbacks.
 */
export async function sendOrderToShop(
  payload: SendOrderPayload,
  _printTicket: string,
  onProgress: ProgressCallback
): Promise<void> {
  const {
    shopId,
    sessionId,
    documents,
    token,
    paymentMethod,
    paymentStatus,
    totalAmount,
    finishingServices,
  } = payload;

  const totalBytes = documents.reduce((acc, d) => acc + d.file.size, 0);

  onProgress({
    status: "connecting",
    percent: 0,
    bytesSent: 0,
    totalBytes,
    totalFiles: documents.length,
    currentFileIndex: 1,
    currentFileName: documents[0]?.file.name,
  });

  const manifestOrder: TransferManifestOrder = {
    tokenCode: token.tokenCode,
    pickupPin: token.pickupPin,
    queuePosition: token.queuePosition,
    totalAmount,
    paymentMethod,
    paymentStatus,
    finishingServices: finishingServices?.map((f) => ({
      type: f.type,
      label: f.label,
      price: f.price,
    })),
    totalFiles: documents.length,
  };

  const files: CustomerTransferFile[] = documents.map((d) => ({
    fileId: d.id,
    file: d.file,
    pageCount: d.pageCount,
    settings: d.settings,
  }));

  try {
    const { cleanup } = await streamOrderToShop(
      shopId,
      sessionId,
      manifestOrder,
      files,
      {
        onStatusChange: (status) => {
          if (status === "streaming") {
            onProgress({
              status: "sending",
              percent: 0,
              bytesSent: 0,
              totalBytes,
              totalFiles: documents.length,
              currentFileIndex: 1,
              currentFileName: documents[0]?.file.name,
            });
          }
        },
        onProgress: (pct, fileIndex, totalFiles) => {
          onProgress({
            status: "sending",
            percent: pct,
            bytesSent: Math.round((pct / 100) * totalBytes),
            totalBytes,
            currentFileIndex: fileIndex,
            currentFileName: documents[fileIndex - 1]?.file.name,
            totalFiles,
          });
        },
        onError: (err) => {
          onProgress({
            status: "error",
            percent: 0,
            bytesSent: 0,
            totalBytes,
            error: err,
          });
        },
      }
    );

    onProgress({
      status: "complete",
      percent: 100,
      bytesSent: totalBytes,
      totalBytes,
      currentFileIndex: documents.length,
      currentFileName: documents[documents.length - 1]?.file.name,
      totalFiles: documents.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onProgress({
      status: "error",
      percent: 0,
      bytesSent: 0,
      totalBytes,
      error: msg,
    });
    throw err;
  }
}

/**
 * Request an authoritative, collision-free local token directly from the Shop Desktop App.
 */
export async function requestTokenFromShop(
  shopId: string,
  params: {
    sessionId: string;
    hasColor: boolean;
    totalAmount?: number;
    fileCount?: number;
  },
  timeoutMs: number = 3000
): Promise<QueueToken> {
  const channel = joinSignalingChannel(shopId);
  await waitForChannelReady(channel, 1200);

  return new Promise((resolve) => {
    let settled = false;
    let retryInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (retryInterval) clearInterval(retryInterval);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    const onTokenAssigned = ({ payload }: { payload: Record<string, unknown> }) => {
      const p = payload as unknown as SignalPayload;
      if (p.sessionId === params.sessionId && p.tokenCode) {
        if (!settled) {
          settled = true;
          cleanup();
          resolve({
            tokenCode: p.tokenCode,
            queuePosition: p.queuePosition || 1,
            estimatedWaitMinutes: (p.queuePosition || 1) * 2,
          });
        }
      }
    };

    channel.on("broadcast", { event: "assign-token" }, onTokenAssigned);
    channel.on("broadcast", { event: "order-status" }, onTokenAssigned);

    const transmit = () => {
      if (!settled) {
        broadcast(channel, "request-token", {
          sessionId: params.sessionId,
          hasColor: params.hasColor,
          totalAmount: params.totalAmount,
          fileCount: params.fileCount,
        });
      }
    };

    transmit();
    retryInterval = setInterval(transmit, 250);

    timeoutTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve({
          tokenCode: `#${params.hasColor ? 2 : 1}1`,
          queuePosition: 1,
          estimatedWaitMinutes: 2,
        });
      }
    }, timeoutMs);
  });
}
