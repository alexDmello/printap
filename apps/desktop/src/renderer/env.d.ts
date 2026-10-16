/// <reference types="vite/client" />

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

/** Type declaration for the API exposed by preload via contextBridge. */

interface PrintResult {
  success: boolean;
  sessionId: string;
  copies?: number;
  error?: string;
}

interface PrinterInfo {
  name: string;
  isDefault: boolean;
  isPhysical: boolean;
  connectionType:
    | "USB"
    | "Network (TCP/IP)"
    | "Network (WSD)"
    | "Network (Shared)"
    | "Network (IPP)"
    | "Bluetooth"
    | "Parallel (LPT)";
  portName: string;
  driverName: string;
  hostAddress?: string | null;
  status: "Online" | "Offline" | "Printing" | "Error" | "Unknown";
  isOnline: boolean;
  details: string;
}

interface ListPrintersResult {
  success: boolean;
  printers: PrinterInfo[];
  error?: string;
}

interface PrintStatusData {
  sessionId: string;
  stage: string;
  detail: string;
}

interface NetworkInfo {
  localIp: string;
  allIps: string[];
}

interface ElectronAPI {
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
  ) => Promise<PrintResult>;

  listPrinters: () => Promise<ListPrintersResult>;

  getNetworkInfo: () => Promise<NetworkInfo>;

  onPrintStatus: (
    callback: (data: PrintStatusData) => void
  ) => () => void;

  setShopOffline: (shopId: string) => Promise<{ success: boolean; error?: string }>;

  setActiveShopId: (shopId: string | null) => Promise<{ success: boolean }>;

  onAppWillQuit: (callback: () => void) => () => void;
  confirmQuit: () => void;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  onDeepLinkAuth: (
    callback: (data: { sessionId: string; shopId: string }) => void
  ) => () => void;
  onUpdaterEvent: (
    callback: (data: { stage: string; progress?: number; error?: string; info?: Record<string, unknown> }) => void
  ) => () => void;
  restartApp: () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
