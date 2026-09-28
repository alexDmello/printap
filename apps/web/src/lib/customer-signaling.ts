/**
 * Customer-side WebRTC handler.
 *
 * Creates a peer connection, generates an SDP offer, and sends it via
 * Supabase Realtime Broadcast. Once the shop's Electron agent answers,
 * a DataChannel is opened and the file is streamed in 64KB chunks.
 *
 * Flow:
 *   1. joinSignalingChannel(shopId)
 *   2. createOffer → broadcast "webrtc-offer"
 *   3. Listen for "webrtc-answer" → setRemoteDescription
 *   4. Exchange ICE candidates via "webrtc-ice"
 *   5. DataChannel opens → sendFile()
 */

import {
  joinSignalingChannel,
  broadcast,
  type SignalPayload,
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
  /** 0–100 */
  percent: number;
  /** Bytes sent so far */
  bytesSent: number;
  /** Total file size */
  totalBytes: number;
  error?: string;
}

type ProgressCallback = (progress: TransferProgress) => void;

/**
 * Connect to the shop's Electron agent and stream a file over WebRTC.
 *
 * Returns the sessionId so the caller can correlate the transfer.
 */
export async function sendFileToShop(
  shopId: string,
  file: File,
  sessionId: string,
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({
    status: "connecting",
    percent: 0,
    bytesSent: 0,
    totalBytes: file.size,
  });

  const channel = joinSignalingChannel(shopId);

  // Wait for channel to be subscribed
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Channel subscribe timeout")), 10_000);
    const checkStatus = () => {
      // Channel status is logged; we give it a short delay to connect
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 1500);
    };
    checkStatus();
  });

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Create the DataChannel BEFORE creating the offer (required by WebRTC spec)
  const dc = pc.createDataChannel("file-transfer", {
    ordered: true,
  });
  dc.binaryType = "arraybuffer";

  // Relay our ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      broadcast(channel, "webrtc-ice", {
        sessionId,
        data: event.candidate.toJSON(),
      });
    }
  };

  // Listen for the shop's answer
  channel.on("broadcast", { event: "webrtc-answer" }, async ({ payload }) => {
    const { sessionId: answerSessionId, data } = payload as SignalPayload;
    if (answerSessionId !== sessionId) return;

    console.log(`[customer] Received answer for session ${sessionId}`);
    await pc.setRemoteDescription(
      new RTCSessionDescription(data as RTCSessionDescriptionInit)
    );
  });

  // Listen for the shop's ICE candidates
  channel.on("broadcast", { event: "webrtc-ice" }, async ({ payload }) => {
    const { sessionId: iceSessionId, data } = payload as SignalPayload;
    if (iceSessionId !== sessionId) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit));
    } catch (err) {
      console.error(`[customer] Failed to add ICE candidate:`, err);
    }
  });

  // When DataChannel opens, stream the file
  dc.onopen = () => {
    console.log(`[customer] DataChannel open — starting file transfer`);
    onProgress({
      status: "connected",
      percent: 0,
      bytesSent: 0,
      totalBytes: file.size,
    });

    streamFile(dc, file, onProgress);
  };

  dc.onerror = (err) => {
    console.error(`[customer] DataChannel error:`, err);
    onProgress({
      status: "error",
      percent: 0,
      bytesSent: 0,
      totalBytes: file.size,
      error: "DataChannel error",
    });
  };

  // Create and send the offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await broadcast(channel, "webrtc-offer", {
    sessionId,
    data: offer,
  });

  console.log(`[customer] Sent offer for session ${sessionId}`);
}

/**
 * Stream a file over the DataChannel in 64KB chunks.
 * Uses bufferedAmountLowThreshold to apply backpressure and prevent
 * browser memory issues with large PDFs.
 */
async function streamFile(
  dc: RTCDataChannel,
  file: File,
  onProgress: ProgressCallback
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Send metadata first
  dc.send(
    JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
    })
  );

  onProgress({
    status: "sending",
    percent: 0,
    bytesSent: 0,
    totalBytes: file.size,
  });

  // Set backpressure threshold (128KB buffer)
  dc.bufferedAmountLowThreshold = 128 * 1024;

  let offset = 0;
  let chunkIndex = 0;

  const sendNextChunk = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const sendChunk = () => {
        while (offset < file.size) {
          // If buffer is getting full, wait for it to drain
          if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null;
              sendChunk();
            };
            return;
          }

          const end = Math.min(offset + CHUNK_SIZE, file.size);
          const slice = file.slice(offset, end);

          // Read the slice as ArrayBuffer and send
          const reader = new FileReader();
          reader.onload = () => {
            try {
              dc.send(reader.result as ArrayBuffer);
              chunkIndex++;
              offset = end;

              onProgress({
                status: "sending",
                percent: Math.round((offset / file.size) * 100),
                bytesSent: offset,
                totalBytes: file.size,
              });

              // Continue with next chunk
              if (offset < file.size) {
                sendChunk();
              } else {
                // All chunks sent — send EOF
                dc.send("EOF");
                onProgress({
                  status: "complete",
                  percent: 100,
                  bytesSent: file.size,
                  totalBytes: file.size,
                });
                resolve();
              }
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(slice);
          return; // Wait for FileReader callback
        }

        // Shouldn't reach here, but just in case
        resolve();
      };

      sendChunk();
    });
  };

  try {
    await sendNextChunk();
  } catch (err) {
    console.error(`[customer] File transfer error:`, err);
    onProgress({
      status: "error",
      percent: Math.round((offset / file.size) * 100),
      bytesSent: offset,
      totalBytes: file.size,
      error: String(err),
    });
  }
}
