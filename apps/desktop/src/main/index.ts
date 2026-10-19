import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import os from "os";
import zlib from "zlib";
import crypto from "crypto";
import { autoUpdater } from "electron-updater";
import * as ptp from "pdf-to-printer";
import srm from "secure-rm";
import { discoverPrinters } from "./printer-discovery";
import { setShopOnline } from "@printap/shared";

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("printap", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("printap");
}

const TEMP_DIR = path.join(os.tmpdir(), "printap_jobs");
const FILE_PREFIX = "mellod_job_";
const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 25 * 1024 * 1024; // 25MB cap per XML entry

let mainWindow: BrowserWindow | null = null;
let activeShopId: string | null = null;
let isCleaningUp = false;

function sanitizeIdentifier(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function handleDeepLink(urlStr: string): void {
  try {
    const parsed = new URL(urlStr);
    const sessionId = parsed.searchParams.get("session");
    const shopId = parsed.searchParams.get("shopId");
    if (sessionId && shopId && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("deep-link-auth", { sessionId, shopId });
    }
  } catch (err) {
    console.warn("[main] Failed to parse deep link URL:", urlStr, err);
  }
}

if ((srm as any).standards && !(srm as any).standards.dod) {
  (srm as any).standards.dod = (srm as any).standards.HMG_IS5 || (srm as any).standards.secure;
  if (Array.isArray((srm as any).validIDs) && !(srm as any).validIDs.includes("dod")) {
    (srm as any).validIDs.push("dod");
  }
}

async function sweepOrphanedTempFiles(): Promise<void> {
  try {
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
      return;
    }
    const entries = await fs.readdir(TEMP_DIR);
    for (const entry of entries) {
      const fullPath = path.join(TEMP_DIR, entry);
      try {
        await srm(fullPath, { standard: "dod" as any });
      } catch {
        try {
          await fs.unlink(fullPath);
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[main] Startup temp sweep warning:", err);
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLinkUrl = commandLine.find((arg) => arg.startsWith("printap://"));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });
}

function createWindow(): void {
  const prodIco = path.join(process.resourcesPath, "icon.ico");
  const prodPng = path.join(process.resourcesPath, "icon.png");
  const devResIco = path.join(__dirname, "../../resources/icon.ico");
  const devBuildIco = path.join(__dirname, "../../build/icon.ico");
  const devPng = path.join(__dirname, "../../resources/icon.png");

  const windowIcon = existsSync(prodIco)
    ? prodIco
    : existsSync(devResIco)
    ? devResIco
    : existsSync(devBuildIco)
    ? devBuildIco
    : existsSync(prodPng)
    ? prodPng
    : existsSync(devPng)
    ? devPng
    : undefined;

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 750,
    minWidth: 920,
    minHeight: 580,
    title: "Printap",
    icon: windowIcon,
    backgroundColor: "#F0EBED",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("close", (e) => {
    if (activeShopId && !isCleaningUp) {
      e.preventDefault();
      performShutdownCleanup();
    }
  });

  const initialDeepLink = process.argv.find((arg) =>
    arg.startsWith("printap://")
  );
  if (initialDeepLink) {
    mainWindow.webContents.once("did-finish-load", () => {
      handleDeepLink(initialDeepLink);
    });
  }
}

function performShutdownCleanup(): void {
  if (isCleaningUp) return;
  isCleaningUp = true;

  const finalizeQuit = async () => {
    await sweepOrphanedTempFiles();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    app.quit();
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const quitTimer = setTimeout(() => {
        finalizeQuit();
      }, 3000);

      ipcMain.once("confirm-quit", () => {
        clearTimeout(quitTimer);
        finalizeQuit();
      });

      mainWindow.webContents.send("app-will-quit");
    } catch {
      finalizeQuit();
    }
  } else {
    finalizeQuit();
  }
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("in.mellod.printap");
  }
  await sweepOrphanedTempFiles();
  createWindow();

  autoUpdater.autoDownload = false; // <--- Changed to false to prevent silent background downloads
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    mainWindow?.webContents.send("updater-event", { stage: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("updater-event", { stage: "available", info });
  });
  autoUpdater.on("update-not-available", (info) => {
    mainWindow?.webContents.send("updater-event", { stage: "not-available", info });
  });
  autoUpdater.on("error", (err) => {
    mainWindow?.webContents.send("updater-event", {
      stage: "error",
      error: err.message,
    });
  });
  autoUpdater.on("download-progress", (progressObj) => {
    mainWindow?.webContents.send("updater-event", {
      stage: "downloading",
      progress: progressObj.percent,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("updater-event", {
      stage: "downloaded",
      info,
    });
  });

  const runUpdateCheck = () => {
    if (!app.isPackaged) {
      console.log("[autoUpdater] Development mode: skipping remote GitHub check");
      setTimeout(() => {
        mainWindow?.webContents.send("updater-event", { stage: "not-available" });
      }, 600);
      return;
    }

    console.log("[autoUpdater] Checking for updates on GitHub...");
    mainWindow?.webContents.send("updater-event", { stage: "checking" });
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn("[autoUpdater] Check error:", err?.message || err);
      mainWindow?.webContents.send("updater-event", {
        stage: "error",
        error: err?.message || String(err),
      });
    });
  };

  if (mainWindow) {
    mainWindow.webContents.once("did-finish-load", () => {
      runUpdateCheck();
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", (e) => {
  if (activeShopId && !isCleaningUp) {
    e.preventDefault();
    performShutdownCleanup();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("restart-app", () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.on("start-download-update", () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("check-for-updates", async () => {
  if (!app.isPackaged) {
    mainWindow?.webContents.send("updater-event", { stage: "not-available" });
    return { success: true, isDev: true, isLatest: true, currentVersion: app.getVersion() };
  }
  try {
    mainWindow?.webContents.send("updater-event", { stage: "checking" });
    const result = await autoUpdater.checkForUpdates();
    const updateAvailable =
      Boolean(result?.updateInfo?.version) &&
      result.updateInfo.version !== app.getVersion();
    return {
      success: true,
      isLatest: !updateAvailable,
      currentVersion: app.getVersion(),
      latestVersion: result?.updateInfo?.version || app.getVersion(),
    };
  } catch (err: any) {
    mainWindow?.webContents.send("updater-event", {
      stage: "error",
      error: err?.message || String(err),
    });
    return { success: false, error: err?.message || String(err), currentVersion: app.getVersion() };
  }
});

ipcMain.handle("open-external", async (_event, url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Blocked non-HTTP/HTTPS external URL");
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error("[main] Failed to open external URL:", err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle("set-active-shop", (_event, shopId: string | null) => {
  activeShopId = shopId;
  return { success: true };
});

ipcMain.handle("set-shop-offline", async (_event, shopId: string) => {
  const targetId = shopId || activeShopId;
  if (!targetId) return { success: true };
  try {
    const result = await setShopOnline(targetId, false);
    if (targetId === activeShopId) {
      activeShopId = null;
    }
    return result;
  } catch (err) {
    console.error("[main] Failed to set shop offline:", err);
    return { success: false, error: String(err) };
  }
});

function sendStatus(sessionId: string, stage: string, detail: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("print-status", { sessionId, stage, detail });
  }
  console.log(`[main] [${sessionId.slice(0, 8)}] ${stage}: ${detail}`);
}

ipcMain.handle("list-printers", async () => {
  try {
    const printers = await discoverPrinters();
    const physicalPrinters = printers.filter((p) => p.isPhysical);
    return { success: true, printers: physicalPrinters };
  } catch (err) {
    console.error("[main] Failed to list printers:", err);
    return { success: false, printers: [], error: String(err) };
  }
});

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function detectImageMime(uint8: Uint8Array): string {
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47)
    return "image/png";
  if (uint8[0] === 0xff && uint8[1] === 0xd8 && uint8[2] === 0xff)
    return "image/jpeg";
  if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46)
    return "image/gif";
  if (uint8[0] === 0x42 && uint8[1] === 0x4d) return "image/bmp";
  if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46)
    return "image/webp";
  return "image/png";
}

function isImageBuffer(uint8: Uint8Array): boolean {
  if (uint8.length < 4) return false;
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47)
    return true;
  if (uint8[0] === 0xff && uint8[1] === 0xd8 && uint8[2] === 0xff) return true;
  if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46) return true;
  if (uint8[0] === 0x42 && uint8[1] === 0x4d) return true;
  if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46)
    return true;
  return false;
}

function isTextBuffer(uint8: Uint8Array): boolean {
  const len = Math.min(uint8.length, 1024);
  for (let i = 0; i < len; i++) {
    if (uint8[i] === 0) return false;
  }
  return true;
}

function extractFilesFromZip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;
  let entries = 0;
  let totalDecompressedBytes = 0;

  while (offset + 30 <= buffer.length && entries < 250) {
    entries++;
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const flags = buffer.readUInt16LE(offset + 6);
    const compression = buffer.readUInt16LE(offset + 8);
    let compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLen;
    if (fileNameEnd > buffer.length) break;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameEnd);

    const dataStart = fileNameEnd + extraLen;

    if ((flags & 0x08) !== 0 && compressedSize === 0) {
      let nextSig = -1;
      for (let i = dataStart; i < buffer.length - 4; i++) {
        if (
          buffer[i] === 0x50 &&
          buffer[i + 1] === 0x4b &&
          ((buffer[i + 2] === 0x03 && buffer[i + 3] === 0x04) ||
            (buffer[i + 2] === 0x01 && buffer[i + 3] === 0x02))
        ) {
          nextSig = i;
          break;
        }
      }
      if (nextSig !== -1) {
        compressedSize = nextSig - dataStart;
        if (
          compressedSize >= 16 &&
          buffer.readUInt32LE(nextSig - 16) === 0x08074b50
        ) {
          compressedSize -= 16;
        } else if (
          compressedSize >= 12 &&
          buffer.readUInt32LE(nextSig - 12) === 0x08074b50
        ) {
          compressedSize -= 12;
        }
      } else {
        compressedSize = buffer.length - dataStart;
      }
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) break;

    if (fileName.endsWith(".xml")) {
      try {
        if (compression === 0) {
          const slice = buffer.subarray(dataStart, dataEnd);
          if (slice.byteLength <= MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
            files.set(fileName, slice);
            totalDecompressedBytes += slice.byteLength;
          }
        } else if (compression === 8) {
          const decompressed = zlib.inflateRawSync(
            buffer.subarray(dataStart, dataEnd),
            { maxOutputLength: MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES }
          );
          files.set(fileName, decompressed);
          totalDecompressedBytes += decompressed.byteLength;
        }
        if (totalDecompressedBytes > 50 * 1024 * 1024) {
          break;
        }
      } catch {
        // Ignore individual corrupt/oversized zip entries
      }
    }

    offset = dataEnd;
  }
  return files;
}

function renderDocxToHtml(
  xml: string,
  orientation?: "portrait" | "landscape"
): string {
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>(.*?)<\/w:p>/gs;
  let match: RegExpExecArray | null;

  while ((match = pRegex.exec(xml)) !== null) {
    const pContent = match[1];
    const tRegex = /<w:t\b[^>]*>([^<]*)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    let pText = "";
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      pText += tMatch[1];
    }
    const isHeading = /<w:pStyle\b[^>]*w:val="Heading(\d)"/i.test(pContent);
    if (pText.trim()) {
      if (isHeading) {
        paragraphs.push(
          `<h2 style="margin: 14pt 0 6pt 0; font-size: 15pt; font-weight: bold; color: #111;">${escapeHtml(
            pText
          )}</h2>`
        );
      } else {
        paragraphs.push(
          `<p style="margin: 0 0 7pt 0; font-size: 11pt; line-height: 1.45; color: #222;">${escapeHtml(
            pText
          )}</p>`
        );
      }
    } else {
      paragraphs.push(`<div style="height: 6pt;"></div>`);
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${orientation === "landscape" ? "landscape" : "portrait"}; margin: 20mm; }
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; margin: 0; background: white; }
  </style>
</head>
<body>
  ${paragraphs.join("\n")}
</body>
</html>`;
}

function renderPptxToHtml(
  files: Map<string, Buffer>,
  _orientation?: "portrait" | "landscape"
): string {
  const slideKeys = Array.from(files.keys())
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      return numA - numB;
    });

  const slidesHtml: string[] = [];
  for (const key of slideKeys) {
    const xml = files.get(key)!.toString("utf8");
    const tRegex = /<a:t>([^<]*)<\/a:t>/g;
    let tMatch: RegExpExecArray | null;
    const texts: string[] = [];
    while ((tMatch = tRegex.exec(xml)) !== null) {
      if (tMatch[1].trim()) texts.push(tMatch[1]);
    }

    slidesHtml.push(`
      <div style="page-break-after: always; width: 100%; min-height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 25mm; box-sizing: border-box; text-align: center;">
        <h1 style="font-size: 22pt; font-weight: bold; margin-bottom: 14pt; color: #111;">${escapeHtml(
          texts[0] || "Slide"
        )}</h1>
        ${texts
          .slice(1)
          .map(
            (t) =>
              `<p style="font-size: 13pt; margin: 5pt 0; color: #333;">${escapeHtml(
                t
              )}</p>`
          )
          .join("")}
      </div>
    `);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: landscape; margin: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: white; }
  </style>
</head>
<body>
  ${slidesHtml.join("\n")}
</body>
</html>`;
}

function renderXlsxToHtml(
  files: Map<string, Buffer>,
  orientation?: "portrait" | "landscape"
): string {
  const sharedStringsXml =
    files.get("xl/sharedStrings.xml")?.toString("utf8") || "";
  const sharedStrings: string[] = [];
  const siRegex = /<si>(.*?)<\/si>/gs;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(sharedStringsXml)) !== null) {
    const tMatch = /<t[^>]*>([^<]*)<\/t>/s.exec(siMatch[1]);
    sharedStrings.push(tMatch ? tMatch[1] : "");
  }

  const sheetXml =
    files.get("xl/worksheets/sheet1.xml")?.toString("utf8") || "";
  const rowRegex = /<row\b[^>]*>(.*?)<\/row>/gs;
  let rowMatch: RegExpExecArray | null;
  const rows: string[][] = [];

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowContent = rowMatch[1];
    const cRegex =
      /<c\b[^>]*?(?:\bt="([^"]*)")?[^>]*>(?:<v>([^<]*)<\/v>)?<\/c>/gs;
    let cMatch: RegExpExecArray | null;
    const cells: string[] = [];

    while ((cMatch = cRegex.exec(rowContent)) !== null) {
      const type = cMatch[1];
      const val = cMatch[2] || "";
      if (type === "s" && sharedStrings[parseInt(val, 10)] !== undefined) {
        cells.push(sharedStrings[parseInt(val, 10)]);
      } else {
        cells.push(val);
      }
    }
    if (cells.length > 0 && cells.some((c) => c.trim())) {
      rows.push(cells);
    }
  }

  const tableRows = rows
    .slice(0, 500)
    .map(
      (r, rIdx) =>
        `<tr>${r
          .map(
            (c) =>
              `<${
                rIdx === 0 ? "th" : "td"
              } style="border: 1px solid #ddd; padding: 5px 8px; font-size: 9pt; ${
                rIdx === 0 ? "background: #f4f4f5; font-weight: bold;" : ""
              }">${escapeHtml(c)}</${rIdx === 0 ? "th" : "td"}>`
          )
          .join("")}</tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${orientation === "portrait" ? "portrait" : "landscape"}; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: white; }
    table { border-collapse: collapse; width: 100%; table-layout: auto; }
  </style>
</head>
<body>
  <table>${tableRows}</table>
</body>
</html>`;
}

async function convertBufferToPdf(
  buffer: ArrayBuffer,
  orientation?: "portrait" | "landscape"
): Promise<Buffer> {
  const uint8 = new Uint8Array(buffer);
  const nodeBuf = Buffer.from(buffer);
  const isImage = isImageBuffer(uint8);
  const isText = isTextBuffer(uint8);
  const isZip =
    uint8.length >= 4 &&
    uint8[0] === 0x50 &&
    uint8[1] === 0x4b &&
    uint8[2] === 0x03 &&
    uint8[3] === 0x04;

  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  const renderId = `render_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const tempHtmlPath = path.join(TEMP_DIR, `${renderId}.html`);
  let tempImagePath: string | null = null;

  const printWin = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      javascript: false,
    },
  });

  try {
    let htmlContent = "";
    if (isImage) {
      const mime = detectImageMime(uint8);
      const ext = mime.includes("png")
        ? "png"
        : mime.includes("webp")
        ? "webp"
        : "jpg";
      tempImagePath = path.join(TEMP_DIR, `${renderId}.${ext}`);
      await fs.writeFile(tempImagePath, nodeBuf);

      const imgFileName = path.basename(tempImagePath);
      htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${orientation === "landscape" ? "landscape" : "portrait"}; margin: 0; }
    html, body { margin: 0; padding: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: white; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; image-orientation: from-image; }
  </style>
</head>
<body>
  <img src="${imgFileName}" />
</body>
</html>`;
    } else if (isZip) {
      const zipFiles = extractFilesFromZip(nodeBuf);
      if (zipFiles.has("word/document.xml")) {
        htmlContent = renderDocxToHtml(
          zipFiles.get("word/document.xml")!.toString("utf8"),
          orientation
        );
      } else if (
        Array.from(zipFiles.keys()).some((k) => k.startsWith("ppt/slides/"))
      ) {
        htmlContent = renderPptxToHtml(zipFiles, orientation);
      } else if (zipFiles.has("xl/worksheets/sheet1.xml")) {
        htmlContent = renderXlsxToHtml(zipFiles, orientation);
      } else {
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const cleanText = decoder
          .decode(buffer)
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
          .trim();
        htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>@page { size: ${
          orientation === "landscape" ? "landscape" : "portrait"
        }; margin: 15mm; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 0; }</style></head><body><div style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(
          cleanText.slice(0, 100000)
        )}</div></body></html>`;
      }
    } else if (isText) {
      const decoder = new TextDecoder("utf-8");
      const text = decoder.decode(buffer);
      htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>@page { size: ${
        orientation === "landscape" ? "landscape" : "portrait"
      }; margin: 15mm; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 0; white-space: pre-wrap; word-wrap: break-word; }</style></head><body>${escapeHtml(
        text
      )}</body></html>`;
    } else {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const cleanText = decoder
        .decode(buffer)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
        .trim();
      htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>@page { size: ${
        orientation === "landscape" ? "landscape" : "portrait"
      }; margin: 15mm; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 0; }</style></head><body><div style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(
        cleanText.slice(0, 100000)
      )}</div></body></html>`;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const conversionPromise = (async () => {
      await fs.writeFile(tempHtmlPath, htmlContent, "utf8");
      await printWin.loadFile(tempHtmlPath);
      await sleep(250);

      const pdfData = await printWin.webContents.printToPDF({
        landscape: orientation === "landscape",
        printBackground: true,
        margins: { marginType: "none" },
      });

      return Buffer.from(pdfData);
    })();

    const timeoutPromise = new Promise<Buffer>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("Document to PDF conversion timed out after 15 seconds"));
      }, 15_000);
    });

    try {
      return await Promise.race([conversionPromise, timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  } finally {
    if (!printWin.isDestroyed()) {
      printWin.destroy();
    }
    await secureDeleteFile(tempHtmlPath);
    if (tempImagePath) {
      await secureDeleteFile(tempImagePath);
    }
  }
}

async function secureDeleteFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) return;
  try {
    await srm(filePath, { standard: "dod" as any });
  } catch {
    try {
      await fs.unlink(filePath);
    } catch {}
  }
}

// ─── IPC: Print PDF (Unique File Per Invocation + Spooler Hold Verification) ───
ipcMain.handle(
  "print-pdf",
  async (
    _event,
    buffer: ArrayBuffer,
    sessionId: string,
    options?: {
      fileId?: string;
      printer?: string;
      copies?: number;
      colorMode?: "bw" | "color";
      duplex?: "single" | "double";
      orientation?: "portrait" | "landscape";
      scale?: "fit" | "noscale";
    }
  ) => {
    const safeSessionId = sanitizeIdentifier(sessionId);
    if (!safeSessionId) throw new Error("Invalid session ID");

    const uniqueJobSuffix = sanitizeIdentifier(
      options?.fileId || crypto.randomUUID().slice(0, 8)
    );
    const shortId = safeSessionId.slice(0, 8);
    const fileName = `${FILE_PREFIX}${safeSessionId}_${uniqueJobSuffix}.pdf`;
    const filePath = path.join(TEMP_DIR, fileName);

    try {
      if (!existsSync(TEMP_DIR)) {
        mkdirSync(TEMP_DIR, { recursive: true });
      }

      const uint8 = new Uint8Array(buffer);
      const isPdf =
        uint8.length >= 4 &&
        uint8[0] === 0x25 && // %
        uint8[1] === 0x50 && // P
        uint8[2] === 0x44 && // D
        uint8[3] === 0x46;   // F

      let pdfBytes: Buffer | Uint8Array;
      if (isPdf) {
        sendStatus(
          sessionId,
          "saving",
          `Writing ${buffer.byteLength} bytes to ${fileName}`
        );
        pdfBytes = uint8;
      } else {
        sendStatus(
          sessionId,
          "saving",
          `Rendering document/image to PDF for hardware spooler...`
        );
        pdfBytes = await convertBufferToPdf(buffer, options?.orientation);
      }

      await fs.writeFile(filePath, pdfBytes, { mode: 0o600 });

      const stat = await fs.stat(filePath);
      if (stat.size !== pdfBytes.byteLength) {
        throw new Error(
          `File size mismatch: expected ${pdfBytes.byteLength}, got ${stat.size}`
        );
      }
      sendStatus(sessionId, "saved", `File prepared (${stat.size} bytes)`);

      const copyCount = Math.max(1, Math.min(500, options?.copies ?? 1));
      sendStatus(
        sessionId,
        "printing",
        `Sending to print spooler (${copyCount} ${copyCount === 1 ? "copy" : "copies"})...`
      );

      const printOptions: ptp.PrintOptions = {
        scale: options?.scale || "noscale",
        copies: copyCount,
        monochrome: options?.colorMode === "bw",
        side: options?.duplex === "double" ? "duplex" : "simplex",
      };

      if (options?.printer) {
        printOptions.printer = options.printer;
      }

      if (options?.orientation) {
        printOptions.orientation = options.orientation;
      }

      await ptp.print(filePath, printOptions);

      sendStatus(sessionId, "printed", `Print job sent (${copyCount} copies)`);
      sendStatus(sessionId, "waiting", "Waiting for spooler to release file...");

      await waitForFileRelease(filePath, 30_000);

      sendStatus(sessionId, "released", "Spooler released the file");
      sendStatus(
        sessionId,
        "shredding",
        "Securely shredding temp file (DoD 5220.22-M)..."
      );

      await secureDeleteFile(filePath);
      sendStatus(sessionId, "shredded", "File securely deleted");
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

      await secureDeleteFile(filePath);

      return {
        success: false,
        sessionId,
        error: errorMsg,
      };
    }
  }
);

async function waitForFileRelease(
  filePath: string,
  timeoutMs: number
): Promise<void> {
  await sleep(1200);

  const start = Date.now();
  const pollInterval = 400;
  let consecutiveSuccesses = 0;

  while (Date.now() - start < timeoutMs) {
    try {
      const handle = await fs.open(filePath, "r+");
      await handle.close();
      consecutiveSuccesses++;
      if (consecutiveSuccesses >= 2) {
        return;
      }
      await sleep(pollInterval);
    } catch {
      consecutiveSuccesses = 0;
      await sleep(pollInterval);
    }
  }

  console.warn(`[main] Timed out waiting for file release after ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
