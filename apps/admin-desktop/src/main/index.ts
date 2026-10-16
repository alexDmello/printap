import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import os from "os";
import { existsSync } from "fs";
import { archivalManager } from "./archival-manager";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const devIcon = path.join(__dirname, "../../resources/icon.png");
  const prodIcon = path.join(process.resourcesPath, "icon.png");
  const windowIcon = existsSync(devIcon) ? devIcon : existsSync(prodIcon) ? prodIcon : undefined;

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1020,
    minHeight: 640,
    title: "Printap Platform Admin — Executive Console",
    icon: windowIcon,
    backgroundColor: "#F0EBED",
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // System IPC Handlers
  ipcMain.handle("get-network-info", () => {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return {
      hostname: os.hostname(),
      ips,
      platform: os.platform(),
    };
  });

  ipcMain.handle("app-version", () => app.getVersion());

  // Archival & Database Lifecycle IPC Handlers
  ipcMain.handle("archival:get-status", async () => {
    return await archivalManager.getDbStatus();
  });

  ipcMain.handle("archival:list-local", async () => {
    const manifest = await archivalManager.readManifest();
    return manifest.archives;
  });

  ipcMain.handle("archival:run-export-purge", async (_event, monthIdentifier?: string) => {
    return await archivalManager.exportAndPurgeMonth({ monthIdentifier });
  });

  ipcMain.handle("archival:open-folder", async (_event, monthIdentifier?: string) => {
    return await archivalManager.openArchiveFolder(monthIdentifier);
  });

  ipcMain.handle("archival:read-month-data", async (_event, monthIdentifier: string) => {
    return await archivalManager.readLocalMonthData(monthIdentifier);
  });

  createWindow();

  // Run automated archival check on app startup
  archivalManager.checkAndRunAutoArchival().catch((err) => {
    console.error("[main] Automated archival check error:", err);
  });

  // Schedule periodic background check every 12 hours
  setInterval(() => {
    archivalManager.checkAndRunAutoArchival().catch((err) => {
      console.error("[main] Scheduled auto archival check error:", err);
    });
  }, 12 * 60 * 60 * 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
