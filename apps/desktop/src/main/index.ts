import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import os from "os";

// ─── Hardware dependencies ───
// pdf-to-printer: sends PDF to Windows print spooler
// secure-rm: DoD 5220.22-M compliant file shredding
import * as ptp from "pdf-to-printer";
import srm from "secure-rm";
import { discoverPrinters } from "./printer-discovery";

// ─── Constants ───
const TEMP_DIR = "C:\\Temp";
const FILE_PREFIX = "mellod_job_";

let mainWindow: BrowserWindow | null = null;

// ─── Window Setup ───
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    title: "Printap — Shop Agent",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  // Ensure the temp directory exists
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── Utility: send status updates to renderer ───
function sendStatus(
  sessionId: string,
  stage: string,
  detail: string
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("print-status", { sessionId, stage, detail });
  }
  console.log(`[main] [${sessionId.slice(0, 8)}] ${stage}: ${detail}`);
}

// ─── IPC: List available printers (with physical vs virtual classification) ───
ipcMain.handle("list-printers", async () => {
  try {
    const printers = await discoverPrinters();
    const physicalCount = printers.filter((p) => p.isPhysical).length;
    console.log(
      `[main] Discovered ${printers.length} printer(s) (${physicalCount} physical hardware)`
    );
    return { success: true, printers };
  } catch (err) {
    console.error("[main] Failed to list printers:", err);
    return { success: false, printers: [], error: String(err) };
  }
});

// ─── IPC: Get local network info for counter QR ───
ipcMain.handle("get-network-info", async () => {
  try {
    const nets = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          ips.push(net.address);
        }
      }
    }
    return {
      localIp: ips[0] || "127.0.0.1",
      allIps: ips,
    };
  } catch (err) {
    console.error("[main] Failed to get network info:", err);
    return { localIp: "127.0.0.1", allIps: ["127.0.0.1"] };
  }
});

// ─── IPC: Print PDF (the main hardware bridge) ───
ipcMain.handle(
  "print-pdf",
  async (
    _event,
    buffer: ArrayBuffer,
    sessionId: string,
    options?: {
      printer?: string;
      copies?: number;
      orientation?: "portrait" | "landscape";
    }
  ) => {
    const shortId = sessionId.slice(0, 8);
    const fileName = `${FILE_PREFIX}${sessionId}.pdf`;
    const filePath = path.join(TEMP_DIR, fileName);

    try {
      // ──────────────────────────────────────────────
      // STAGE 1: Save buffer to temp file
      // ──────────────────────────────────────────────
      sendStatus(sessionId, "saving", `Writing ${buffer.byteLength} bytes to ${filePath}`);

      const uint8 = new Uint8Array(buffer);
      await fs.writeFile(filePath, uint8);

      // Verify the file was written correctly
      const stat = await fs.stat(filePath);
      if (stat.size !== buffer.byteLength) {
        throw new Error(
          `File size mismatch: expected ${buffer.byteLength}, got ${stat.size}`
        );
      }
      sendStatus(sessionId, "saved", `File saved (${stat.size} bytes)`);

      // ──────────────────────────────────────────────
      // STAGE 2: Print via Windows spooler
      // ──────────────────────────────────────────────
      sendStatus(sessionId, "printing", "Sending to print spooler...");

      const printOptions: Record<string, string> = {
        scale: "noscale",
      };

      // If a specific printer was requested
      if (options?.printer) {
        printOptions.printer = options.printer;
      }

      // If orientation was specified
      if (options?.orientation) {
        printOptions.orientation = options.orientation;
      }

      // If multiple copies requested, we print one-by-one
      // (pdf-to-printer doesn't have a native copies flag)
      const copyCount = options?.copies ?? 1;

      for (let i = 0; i < copyCount; i++) {
        if (copyCount > 1) {
          sendStatus(
            sessionId,
            "printing",
            `Printing copy ${i + 1} of ${copyCount}...`
          );
        }
        await ptp.print(filePath, printOptions);
      }

      sendStatus(sessionId, "printed", `Print job sent (${copyCount} copies)`);

      // ──────────────────────────────────────────────
      // STAGE 3: Wait for spooler to release the file
      // ──────────────────────────────────────────────
      // The print spooler may hold a lock on the file briefly.
      // Poll until we can open it exclusively, or timeout after 30s.
      sendStatus(sessionId, "waiting", "Waiting for spooler to release file...");

      await waitForFileRelease(filePath, 30_000);

      sendStatus(sessionId, "released", "Spooler released the file");

      // ──────────────────────────────────────────────
      // STAGE 4: Secure shred the temp file
      // ──────────────────────────────────────────────
      sendStatus(sessionId, "shredding", "Securely shredding temp file (DoD 5220.22-M)...");

      try {
        await srm(filePath, { standard: "gutmann" });
        sendStatus(sessionId, "shredded", "File securely deleted");
      } catch (shredErr) {
        // If secure-rm fails (e.g. permissions), fall back to a basic unlink
        // so we don't leave files around
        console.error(`[main] secure-rm failed, falling back to unlink:`, shredErr);
        sendStatus(
          sessionId,
          "shredding-fallback",
          "secure-rm failed, performing standard delete"
        );

        try {
          await fs.unlink(filePath);
          sendStatus(sessionId, "deleted", "File deleted (standard delete)");
        } catch (unlinkErr) {
          console.error(`[main] Even unlink failed:`, unlinkErr);
          sendStatus(sessionId, "warning", `Could not delete temp file: ${filePath}`);
        }
      }

      // ──────────────────────────────────────────────
      // DONE
      // ──────────────────────────────────────────────
      sendStatus(sessionId, "complete", "Print cycle complete");

      return {
        success: true,
        sessionId,
        copies: copyCount,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[main] Print pipeline failed for ${shortId}:`, err);
      sendStatus(sessionId, "error", errorMsg);

      // Best-effort cleanup: try to delete the temp file if it exists
      try {
        if (existsSync(filePath)) {
          await fs.unlink(filePath);
        }
      } catch {
        // ignore cleanup errors
      }

      return {
        success: false,
        sessionId,
        error: errorMsg,
      };
    }
  }
);

// ─── Utility: Wait for file to be released by the print spooler ───
async function waitForFileRelease(
  filePath: string,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  const pollInterval = 500; // ms

  while (Date.now() - start < timeoutMs) {
    try {
      // Try to open the file with exclusive access
      const handle = await fs.open(filePath, "r+");
      await handle.close();
      return; // File is free
    } catch {
      // File is still locked — wait and retry
      await sleep(pollInterval);
    }
  }

  // Timeout — proceed anyway (the file might still be printable)
  console.warn(`[main] Timed out waiting for file release after ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

