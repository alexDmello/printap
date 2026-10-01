/**
 * Customer-side WebRTC handler for Multi-File & Print Settings Streaming.
 *
 * Creates a peer connection, generates an SDP offer, and sends it via
 * Supabase Realtime Broadcast. Once the shop's Electron agent answers,
 * a DataChannel is opened and:
 *   1. Sends order manifest (token code, pickup PIN, total, settings, file list)
 *   2. Sequentially streams each file in 64KB chunks with backpressure
 *   3. Emits per-file and overall progress updates
 *   4. Sends order completion signal
 */

import {
  joinSignalingChannel,
  broadcast,
  type SignalPayload,
  type UploadedDocument,
  type QueueToken,
  type PaymentMethod,
  type PaymentStatus,
  type FinishingService,
  type TransferManifestMessage,
  type TransferFileHeaderMessage,
  type TransferFileEofMessage,
  type TransferOrderCompleteMessage,
} from "@printap/shared";

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type TransferStatus =
  | "connecting"
  | "connected"
  | "sending"
  | "complete"
  | "error";

export interface TransferProgress {
  status: TransferStatus;
  /** 0–100 overall progress */
  percent: number;
  /** Bytes sent so far across all files */
  bytesSent: number;
  /** Total bytes of all files combined */
  totalBytes: number;
  /** 1-indexed number of the file currently being transferred */
  currentFileIndex?: number;
  /** Name of the current file being transferred */
  currentFileName?: string;
  /** Total number of files in this order */
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

/**
 * Connect to the shop's Electron agent and stream an entire order
 * (manifest + multiple files with print settings) over WebRTC.
 */
export async function sendOrderToShop(
  payload: SendOrderPayload,
  onProgress: ProgressCallback
): Promise<void> {
  const { shopId, sessionId, documents } = payload;
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

  const channel = joinSignalingChannel(shopId);

  // Wait for channel to subscribe
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Channel subscribe timeout")),
      10_000
    );
    setTimeout(() => {
      clearTimeout(timeout);
      resolve();
    }, 1200);
  });

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Create DataChannel before offer
  const dc = pc.createDataChannel("order-transfer", {
    ordered: true,
  });
  dc.binaryType = "arraybuffer";

  // Relay ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      broadcast(channel, "webrtc-ice", {
        sessionId,
        data: event.candidate.toJSON(),
      });
    }
  };

  // Listen for shop answer
  channel.on("broadcast", { event: "webrtc-answer" }, async ({ payload: resPayload }) => {
    const { sessionId: answerSessionId, data } = resPayload as SignalPayload;
    if (answerSessionId !== sessionId) return;

    console.log(`[customer] Received answer for session ${sessionId}`);
    await pc.setRemoteDescription(
      new RTCSessionDescription(data as RTCSessionDescriptionInit)
    );
  });

  // Listen for shop ICE candidates
  channel.on("broadcast", { event: "webrtc-ice" }, async ({ payload: resPayload }) => {
    const { sessionId: iceSessionId, data } = resPayload as SignalPayload;
    if (iceSessionId !== sessionId) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit));
    } catch (err) {
      console.error(`[customer] Failed to add ICE candidate:`, err);
    }
  });

  // Handle data channel lifecycle
  dc.onopen = async () => {
    console.log(`[customer] DataChannel opened — streaming order manifest & files`);
    onProgress({
      status: "connected",
      percent: 0,
      bytesSent: 0,
      totalBytes,
      totalFiles: documents.length,
      currentFileIndex: 1,
      currentFileName: documents[0]?.file.name,
    });

    try {
      await streamOrder(dc, payload, onProgress);
    } catch (err) {
      console.error(`[customer] Error during order stream:`, err);
      onProgress({
        status: "error",
        percent: 0,
        bytesSent: 0,
        totalBytes,
        error: String(err),
      });
    }
  };

  dc.onerror = (err) => {
    console.error(`[customer] DataChannel error:`, err);
    onProgress({
      status: "error",
      percent: 0,
      bytesSent: 0,
      totalBytes,
      error: "DataChannel error",
    });
  };

  // Create and send offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await broadcast(channel, "webrtc-offer", {
    sessionId,
    data: offer,
  });

  console.log(`[customer] Sent offer for session ${sessionId}`);
}

/**
 * Streams the order manifest and sequentially transmits each document.
 */
async function streamOrder(
  dc: RTCDataChannel,
  payload: SendOrderPayload,
  onProgress: ProgressCallback
): Promise<void> {
  const {
    documents,
    token,
    sessionId,
    paymentMethod,
    paymentStatus,
    totalAmount,
    finishingServices,
  } = payload;
  const totalBytes = documents.reduce((acc, d) => acc + d.file.size, 0);

  // 1. Send Order Manifest
  const manifest: TransferManifestMessage = {
    type: "order-manifest",
    sessionId,
    order: {
      tokenCode: token.tokenCode,
      pickupPin: token.pickupPin,
      queuePosition: token.queuePosition,
      totalAmount,
      paymentMethod,
      paymentStatus,
      finishingServices: finishingServices.map((f) => ({
        type: f.type,
        label: f.label,
        price: f.price,
      })),
      totalFiles: documents.length,
    },
    files: documents.map((d) => ({
      fileId: d.id,
      fileName: d.file.name,
      fileSize: d.file.size,
      pageCount: d.pageCount,
      settings: d.settings,
    })),
  };

  dc.send(JSON.stringify(manifest));

  // Set backpressure threshold
  dc.bufferedAmountLowThreshold = 128 * 1024;
  let overallBytesSent = 0;

  // 2. Stream each document
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const file = doc.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Send file header
    const fileHeader: TransferFileHeaderMessage = {
      type: "file-header",
      sessionId,
      fileId: doc.id,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      pageCount: doc.pageCount,
      settings: doc.settings,
    };
    dc.send(JSON.stringify(fileHeader));

    onProgress({
      status: "sending",
      percent: totalBytes > 0 ? Math.round((overallBytesSent / totalBytes) * 100) : 0,
      bytesSent: overallBytesSent,
      totalBytes,
      currentFileIndex: i + 1,
      currentFileName: file.name,
      totalFiles: documents.length,
    });

    let offset = 0;
    while (offset < file.size) {
      // Check buffer drain if approaching threshold
      if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
        await new Promise<void>((resolve) => {
          dc.onbufferedamountlow = () => {
            dc.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const slice = file.slice(offset, end);
      const buf = await slice.arrayBuffer();

      dc.send(buf);
      overallBytesSent += (end - offset);
      offset = end;

      onProgress({
        status: "sending",
        percent: totalBytes > 0 ? Math.round((overallBytesSent / totalBytes) * 100) : 0,
        bytesSent: overallBytesSent,
        totalBytes,
        currentFileIndex: i + 1,
        currentFileName: file.name,
        totalFiles: documents.length,
      });
    }

    // Send file-eof for this file
    const fileEof: TransferFileEofMessage = {
      type: "file-eof",
      sessionId,
      fileId: doc.id,
    };
    dc.send(JSON.stringify(fileEof));
    // Also send legacy "EOF" string for older shop terminals
    dc.send("EOF");
  }

  // 3. Send order-complete message
  const orderComplete: TransferOrderCompleteMessage = {
    type: "order-complete",
    sessionId,
  };
  dc.send(JSON.stringify(orderComplete));

  onProgress({
    status: "complete",
    percent: 100,
    bytesSent: totalBytes,
    totalBytes,
    currentFileIndex: documents.length,
    currentFileName: documents[documents.length - 1]?.file.name,
    totalFiles: documents.length,
  });
}

/**
 * Legacy single-file transfer wrapper for backwards compatibility.
 */
export async function sendFileToShop(
  shopId: string,
  file: File,
  sessionId: string,
  onProgress: ProgressCallback
): Promise<void> {
  const dummyDoc: UploadedDocument = {
    id: crypto.randomUUID(),
    file,
    type: file.type.includes("pdf") ? "pdf" : "image",
    pageCount: 1,
    settings: {
      copies: 1,
      colorMode: "bw",
      duplex: "single",
      pagesPerSheet: 1,
      pageFit: "fit",
      orientation: "portrait",
    },
  };

  const dummyToken: QueueToken = {
    tokenCode: "A-01",
    pickupPin: "1234",
    queuePosition: 1,
    estimatedWaitMinutes: 2,
  };

  return sendOrderToShop(
    {
      shopId,
      sessionId,
      documents: [dummyDoc],
      token: dummyToken,
      paymentMethod: "upi",
      paymentStatus: "confirmed",
      totalAmount: 0,
      finishingServices: [],
    },
    onProgress
  );
}

/**
 * Request an authoritative, collision-free local token directly from the Shop Desktop App.
 * Uses the Supabase signaling broadcast channel with zero DB count queries.
 */
export async function requestTokenFromShop(
  shopId: string,
  params: {
    sessionId: string;
    hasColor: boolean;
    totalAmount?: number;
    fileCount?: number;
  },
  timeoutMs: number = 2500
): Promise<QueueToken> {
  return new Promise((resolve) => {
    let settled = false;
    const channel = joinSignalingChannel(shopId);

    const onTokenAssigned = ({ payload }: { payload: Record<string, unknown> }) => {
      const p = payload as unknown as SignalPayload;
      if (p.sessionId === params.sessionId && p.tokenCode) {
        if (!settled) {
          settled = true;
          console.log(`[customer] Received authoritative local token from shop: ${p.tokenCode}`);
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

    // Broadcast request-token event
    broadcast(channel, "request-token", {
      sessionId: params.sessionId,
      hasColor: params.hasColor,
      totalAmount: params.totalAmount,
      fileCount: params.fileCount,
    });

    // Fallback if shop desktop takes longer than timeoutMs to respond
    setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn("[customer] request-token timeout, using provisional local token");
        resolve({
          tokenCode: `#${params.hasColor ? 2 : 1}1`,
          queuePosition: 1,
          estimatedWaitMinutes: 2,
        });
      }
    }, timeoutMs);
  });
}

