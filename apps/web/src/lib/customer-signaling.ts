/**
 * Customer-side WebRTC handler for Multi-File & Print Settings Streaming.
 *
 * Creates a peer connection, generates an SDP offer with ICE candidate preroll,
 * relays ICE candidates with early-candidate buffering, and transfers
 * the complete order manifest and file stream via RTCDataChannel.
 */

import {
  joinSignalingChannel,
  waitForChannelReady,
  broadcast,
  DEFAULT_ICE_SERVERS,
  waitForIceGathering,
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

// 32KB safe WebRTC chunk size across iOS Safari, Android Chrome, and Windows/Mac
const CHUNK_SIZE = 32 * 1024;

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
 * Returns a Promise that resolves when all files have finished streaming,
 * or rejects if connection/transfer fails.
 */
export function sendOrderToShop(
  payload: SendOrderPayload,
  printTicket: string,
  onProgress: ProgressCallback
): Promise<void> {
  const { shopId, sessionId, documents } = payload;
  const totalBytes = documents.reduce((acc, d) => acc + d.file.size, 0);

  return new Promise<void>(async (resolve, reject) => {
    let settled = false;
    let offerRetryTimer: any = null;
    let overallTimeoutTimer: any = null;
    let pc: RTCPeerConnection | null = null;
    let dc: RTCDataChannel | null = null;

    const cleanup = () => {
      if (offerRetryTimer) {
        clearInterval(offerRetryTimer);
        offerRetryTimer = null;
      }
      if (overallTimeoutTimer) {
        clearTimeout(overallTimeoutTimer);
        overallTimeoutTimer = null;
      }
    };

    const fail = (errorMessage: string) => {
      if (settled) return;
      settled = true;
      cleanup();

      console.error(`[customer] sendOrderToShop failed: ${errorMessage}`);
      onProgress({
        status: "error",
        percent: 0,
        bytesSent: 0,
        totalBytes,
        error: errorMessage,
      });

      try {
        dc?.close();
        pc?.close();
      } catch {}

      reject(new Error(errorMessage));
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();

      console.log(`[customer] sendOrderToShop successfully completed for session ${sessionId}`);
      onProgress({
        status: "complete",
        percent: 100,
        bytesSent: totalBytes,
        totalBytes,
        currentFileIndex: documents.length,
        currentFileName: documents[documents.length - 1]?.file.name,
        totalFiles: documents.length,
      });

      resolve();
    };

    // 1. Initial status
    onProgress({
      status: "connecting",
      percent: 0,
      bytesSent: 0,
      totalBytes,
      totalFiles: documents.length,
      currentFileIndex: 1,
      currentFileName: documents[0]?.file.name,
    });

    // 2. Timeout safeguard (35 seconds)
    overallTimeoutTimer = setTimeout(() => {
      fail(
        "Connection to counter terminal timed out. Please ensure the shop desktop app is running and connected."
      );
    }, 35_000);

    try {
      const channel = joinSignalingChannel(shopId);
      await waitForChannelReady(channel, 2000);

      // 4. Initialize RTCPeerConnection with unified resilient STUN servers & candidate pool
      pc = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 10,
      });

      // 5. Create DataChannel before creating the offer
      dc = pc.createDataChannel("order-transfer", {
        ordered: true,
      });
      dc.binaryType = "arraybuffer";

      // 5. Early candidate buffer
      const earlyCandidates: RTCIceCandidateInit[] = [];
      let remoteDescriptionSet = false;

      // 6. Relay local ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          broadcast(channel, "webrtc-ice", {
            sessionId,
            data: event.candidate.toJSON(),
          });
        }
      };

      // 7. Track connection state
      pc.onconnectionstatechange = () => {
        if (!pc) return;
        console.log(
          `[customer] Connection state: ${pc.connectionState} (ice: ${pc.iceConnectionState})`
        );
        if (pc.connectionState === "failed") {
          fail("WebRTC direct peer connection failed. NAT traversal could not find an open path.");
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!pc) return;
        console.log(`[customer] ICE state: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === "failed") {
          try {
            if (typeof pc.restartIce === "function") {
              console.log("[customer] Restarting ICE...");
              pc.restartIce();
            }
          } catch (e) {
            console.warn("[customer] restartIce error:", e);
          }
        }
      };

      // 8. Listen for shop answer
      channel.on("broadcast", { event: "webrtc-answer" }, async ({ payload: resPayload }) => {
        const { sessionId: answerSessionId, data } = resPayload as SignalPayload;
        if (answerSessionId !== sessionId || !pc) return;

        if (offerRetryTimer) {
          clearInterval(offerRetryTimer);
          offerRetryTimer = null;
        }

        console.log(`[customer] Received answer for session ${sessionId}`);
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription(data as RTCSessionDescriptionInit)
            );
            remoteDescriptionSet = true;

            // Drain buffered early candidates
            if (earlyCandidates.length > 0) {
              console.log(
                `[customer] Draining ${earlyCandidates.length} buffered ICE candidates for ${sessionId}`
              );
              for (const cand of earlyCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (candErr) {
                  console.warn("[customer] Failed adding buffered candidate:", candErr);
                }
              }
              earlyCandidates.length = 0;
            }
          }
        } catch (err) {
          console.warn("[customer] setRemoteDescription error:", err);
        }
      });

      // 9. Listen for shop ICE candidates
      channel.on("broadcast", { event: "webrtc-ice" }, async ({ payload: resPayload }) => {
        const { sessionId: iceSessionId, data } = resPayload as SignalPayload;
        if (iceSessionId !== sessionId || !pc) return;

        const candidateInit = data as RTCIceCandidateInit;
        if (!candidateInit || !candidateInit.candidate) return;

        if (!remoteDescriptionSet || !pc.remoteDescription) {
          earlyCandidates.push(candidateInit);
          return;
        }

        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (err) {
          console.warn(`[customer] Failed to add ICE candidate:`, err);
        }
      });

      // 10. Listen for terminal hardware errors
      channel.on("broadcast", { event: "order-status" }, ({ payload: resPayload }) => {
        const p = resPayload as SignalPayload;
        if (p.sessionId !== sessionId) return;
        if (p.status === "error") {
          fail(p.errorDetail || "Shop counter terminal reported a hardware/spooler error");
        }
      });

      // 11. DataChannel lifecycle
      dc.onopen = async () => {
        if (offerRetryTimer) {
          clearInterval(offerRetryTimer);
          offerRetryTimer = null;
        }

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
          await streamOrder(dc!, payload, printTicket, onProgress);
          succeed();
        } catch (err) {
          fail(`Transfer error: ${String(err)}`);
        }
      };

      dc.onerror = () => {
        fail("DataChannel connection interrupted during transfer");
      };

      // 12. Create and set local offer with ICE candidate gathering preroll
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait up to 800ms so initial LAN & STUN candidates are embedded directly in offer SDP
      await waitForIceGathering(pc, 800);

      const sendOffer = async () => {
        if (!pc || pc.signalingState !== "have-local-offer") return;
        const localDesc = pc.localDescription || offer;
        console.log(`[customer] Transmitting offer for session ${sessionId}`);
        await broadcast(channel, "webrtc-offer", {
          sessionId,
          data: { type: localDesc.type, sdp: localDesc.sdp },
        });
      };

      await sendOffer();

      // Retry offer up to 4 times (every 2.5s) if connection has not established
      let offerRetries = 0;
      offerRetryTimer = setInterval(async () => {
        if (
          !pc ||
          pc.remoteDescription ||
          pc.signalingState === "stable" ||
          offerRetries >= 4
        ) {
          if (offerRetryTimer) {
            clearInterval(offerRetryTimer);
            offerRetryTimer = null;
          }
          return;
        }
        offerRetries++;
        console.log(
          `[customer] Re-transmitting offer (attempt ${offerRetries + 1}/5) for session ${sessionId}`
        );
        await sendOffer();
      }, 2500);
    } catch (err) {
      fail(String(err));
    }
  });
}

/**
 * Streams the order manifest and sequentially transmits each document.
 */
async function streamOrder(
  dc: RTCDataChannel,
  payload: SendOrderPayload,
  printTicket: string,
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
    printTicket,
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
  timeoutMs: number = 3000
): Promise<QueueToken> {
  const channel = joinSignalingChannel(shopId);

  // 1. Ensure channel is in SUBSCRIBED state before transmitting
  await waitForChannelReady(channel, 1200);

  return new Promise((resolve) => {
    let settled = false;
    let retryInterval: any = null;
    let timeoutTimer: any = null;

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

    // 2. Immediate transmit
    transmit();

    // 3. Rapid retry every 250ms in case first packet was dropped during connection
    retryInterval = setInterval(transmit, 250);

    // 4. Fallback if shop desktop takes longer than timeoutMs to respond
    timeoutTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
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
