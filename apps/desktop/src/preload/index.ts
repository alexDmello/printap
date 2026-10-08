import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes a safe, typed API to the renderer via contextBridge.
 *
 * Available methods:
 * - printPdf(buffer, sessionId, options?) → prints and shreds
 * - listPrinters() → returns available Windows printers
 * - onPrintStatus(callback) → live status updates from main process
 */
contextBridge.exposeInMainWorld("electronAPI", {
  printPdf: (
    buffer: ArrayBuffer,
    sessionId: string,
    options?: {
      printer?: string;
      copies?: number;
      orientation?: "portrait" | "landscape";
    }
  ) => ipcRenderer.invoke("print-pdf", buffer, sessionId, options),

  listPrinters: () => ipcRenderer.invoke("list-printers"),

  getNetworkInfo: () => ipcRenderer.invoke("get-network-info"),

  onPrintStatus: (
    callback: (data: { sessionId: string; stage: string; detail: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { sessionId: string; stage: string; detail: string }
    ) => callback(data);

    ipcRenderer.on("print-status", handler);

    // Return a cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener("print-status", handler);
    };
  },

  setShopOffline: (shopId: string) =>
    ipcRenderer.invoke("set-shop-offline", shopId),

  setActiveShopId: (shopId: string | null) =>
    ipcRenderer.invoke("set-active-shop", shopId),

  onAppWillQuit: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("app-will-quit", handler);
    return () => {
      ipcRenderer.removeListener("app-will-quit", handler);
    };
  },

  confirmQuit: () => ipcRenderer.send("confirm-quit"),

  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),

  onDeepLinkAuth: (
    callback: (data: { sessionId: string; shopId: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { sessionId: string; shopId: string }
    ) => callback(data);

    ipcRenderer.on("deep-link-auth", handler);

    return () => {
      ipcRenderer.removeListener("deep-link-auth", handler);
    };
  },
  onUpdaterEvent: (
    callback: (data: { stage: string; progress?: number; error?: string; info?: any }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { stage: string; progress?: number; error?: string; info?: any }
    ) => callback(data);

    ipcRenderer.on("updater-event", handler);

    return () => {
      ipcRenderer.removeListener("updater-event", handler);
    };
  },
  restartApp: () => ipcRenderer.send("restart-app"),
});


