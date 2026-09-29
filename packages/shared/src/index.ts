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
  extractSubdomain,
  type SubdomainType,
} from "./domains";

export {
  DEFAULT_PRINT_SETTINGS,
  DEFAULT_FINISHING_SERVICES,
  DEFAULT_RATE_CARD,
  SESSION_STORAGE_KEY,
  calculateSheets,
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

export interface ShopInfo {
  id: string;
  name: string;
  slug?: string;
  upi_vpa: string;
  status: "active" | "suspended" | string;
  /** Shop rate card (pricing) */
  price_bw?: number;
  price_color?: number;
  created_at: string;
}
