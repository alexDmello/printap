import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getNetworkInfo: () => ipcRenderer.invoke("get-network-info"),
  getAppVersion: () => ipcRenderer.invoke("app-version"),
  archival: {
    getStatus: () => ipcRenderer.invoke("archival:get-status"),
    listLocal: () => ipcRenderer.invoke("archival:list-local"),
    runExportPurge: (month?: string) => ipcRenderer.invoke("archival:run-export-purge", month),
    openFolder: (month?: string) => ipcRenderer.invoke("archival:open-folder", month),
    readMonthData: (month: string) => ipcRenderer.invoke("archival:read-month-data", month),
  },
});
