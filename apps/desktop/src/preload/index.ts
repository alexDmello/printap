import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  printPdf: (
    buffer: ArrayBuffer,
    sessionId: string,
    options?: {
      fileId?: string;
      printer?: string;
      copies?: number;
      orientation?: "portrait" | "landscape";
      scale?: "fit" | "noscale";
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
    callback: (data: {
      stage: string;
      progress?: number;
      error?: string;
      info?: Record<string, unknown>;
    }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: {
        stage: string;
        progress?: number;
        error?: string;
        info?: Record<string, unknown>;
      }
    ) => callback(data);

    ipcRenderer.on("updater-event", handler);
    return () => {
      ipcRenderer.removeListener("updater-event", handler);
    };
  },

  restartApp: () => ipcRenderer.send("restart-app"),
});
