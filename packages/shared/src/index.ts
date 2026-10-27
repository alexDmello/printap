export { getSupabase } from "./supabase";
export {
  joinSignalingChannel,
  leaveSignalingChannel,
  waitForChannelReady,
  broadcast,
  channelName,
  DEFAULT_ICE_SERVERS,
  waitForIceGathering,
  type SignalEvent,
  type SignalPayload,
} from "./signaling";
export {
  ROOT_DOMAIN,
  SHOP_ADMIN_SUBDOMAIN,
  PLATFORM_ADMIN_SUBDOMAIN,
  RESERVED_SUBDOMAINS,
  isReservedSubdomain,
  isValidSubdomainLabel,
  isValidSubdomain,
  MARKETING_URL,
  sanitizeSubdomain,
  getCustomerPrintUrl,
  getShopCustomerUrl,
  extractSubdomain,
  isLocalOrPrivateHost,
  type SubdomainType,
} from "./domains";

export {
  validateEmail,
  isValidEmail,
  type EmailValidationResult,
} from "./validation";
export {
  DEFAULT_PRINT_SETTINGS,
  DEFAULT_FINISHING_SERVICES,
  DEFAULT_SHOP_SERVICES,
  DEFAULT_RATE_CARD,
  SESSION_STORAGE_KEY,
  isOrderCompleted,
  isOrderFailed,
  calculateSheets,
  calculateOrderSheets,
  calculateDocumentPrice,
  calculateFinishingCost,
  calculateOrderTotal,
  parsePageRangeCount,
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
  token_balance?: number;
  /** Shop rate card (pricing) */
  price_bw?: number;
  price_color?: number;
  services?: import("./types").ShopServiceItem[];
  platform_fee?: number;
  gst_percentage?: number;
  gst_amount?: number;
  total_charge?: number;
  /** Owner authentication & Contact */
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  email_verified?: boolean;
  /** Geolocation & Store Address */
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  created_at?: string;
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

export type {
  ShopDailyAnalytics,
  PlatformDailyAnalytics,
  ArchiveAuditLog,
  MonthlyArchiveManifest,
} from "./types";

