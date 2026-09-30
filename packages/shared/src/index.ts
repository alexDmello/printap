export { getSupabase } from "./supabase";
export {
  joinSignalingChannel,
  broadcast,
  channelName,
  type SignalEvent,
  type SignalPayload,
} from "./signaling";
export {
  ROOT_DOMAIN,
  SHOP_ADMIN_SUBDOMAIN,
  PLATFORM_ADMIN_SUBDOMAIN,
  MARKETING_URL,
  SHOP_ADMIN_URL,
  PLATFORM_ADMIN_URL,
  sanitizeSubdomain,
  getCustomerPrintUrl,
  getShopCustomerUrl,
  extractSubdomain,
  type SubdomainType,
} from "./domains";

export {
  DEFAULT_PRINT_SETTINGS,
  DEFAULT_FINISHING_SERVICES,
  DEFAULT_SHOP_SERVICES,
  DEFAULT_RATE_CARD,
  SESSION_STORAGE_KEY,
  calculateSheets,
  calculateOrderSheets,
  calculateDocumentPrice,
  calculateFinishingCost,
  calculateOrderTotal,
  type ColorMode,
  type DuplexMode,
  type PagesPerSheet,
  type PageFit,
  type Orientation,
  type PrintSettings,
  type DocumentType,
  type UploadedDocument,
  type ServiceUnit,
  type ShopServiceItem,
  type FinishingServiceType,
  type FinishingChargeUnit,
  type FinishingService,
  type ShopRateCard,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentInfo,
  type JobStatus,
  type QueueToken,
  type PrintOrder,
  type PersistedSession,
  type TransferManifestOrder,
  type TransferManifestFile,
  type TransferManifestMessage,
  type TransferFileHeaderMessage,
  type TransferFileEofMessage,
  type TransferOrderCompleteMessage,
  type TransferMessage,
} from "./types";

export {
  HEARTBEAT_INTERVAL_MS,
  presenceChannelName,
  setShopOnline,
  type ShopPresencePayload,
} from "./presence";

export interface ShopInfo {
  id: string;
  name: string;
  slug?: string;
  upi_vpa: string;
  status: "active" | "suspended" | string;
  is_online?: boolean;
  last_seen_at?: string;
  /** Shop rate card (pricing) */
  price_bw?: number;
  price_color?: number;
  services?: import("./types").ShopServiceItem[];
  platform_fee?: number;
  gst_percentage?: number;
  gst_amount?: number;
  total_charge?: number;
  created_at: string;
}

export interface PlatformSettings {
  id: string;
  platform_fee: number;
  gst_percentage: number;
  gst_amount: number;
  total_charge: number;
  updated_at?: string;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  id: "global",
  platform_fee: 0.82,
  gst_percentage: 18.0,
  gst_amount: 0.18,
  total_charge: 1.0,
};

