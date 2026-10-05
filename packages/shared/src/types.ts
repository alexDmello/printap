/**
 * Printap — Shared Type Definitions
 *
 * Defines all data contracts for the customer print flow,
 * shop rate cards, finishing services, and queue/token system.
 */

// ─── Print Settings (per-document) ───

export type ColorMode = "bw" | "color";
export type DuplexMode = "single" | "double";
export type PagesPerSheet = 1 | 2 | 4 | 6 | 9;
export type PageFit = "fit" | "fill";
export type Orientation = "portrait" | "landscape";

export interface PrintSettings {
  copies: number;
  colorMode: ColorMode;
  duplex: DuplexMode;
  pagesPerSheet: PagesPerSheet;
  pageFit: PageFit;
  orientation: Orientation;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  copies: 1,
  colorMode: "bw",
  duplex: "single",
  pagesPerSheet: 1,
  pageFit: "fit",
  orientation: "portrait",
};

export type DocumentType =
  | "pdf"
  | "image"
  | "doc"
  | "sheet"
  | "presentation"
  | "text"
  | "other";

export interface UploadedDocument {
  /** Client-side unique ID for this document in the batch */
  id: string;
  file: File;
  type: DocumentType;
  /** Page count (parsed client-side for PDFs, 1 for images) */
  pageCount: number;
  /** Thumbnail data URL (first page render for PDFs, image preview for photos) */
  thumbnailUrl?: string;
  /** Per-document print settings */
  settings: PrintSettings;
}

// ─── Finishing / Add-on & Shop Services ───

export type ServiceUnit = "per_copy" | "per_sheet" | "per_document" | "flat";

export interface ShopServiceItem {
  id: string;
  name: string;
  price: number;
  unit: ServiceUnit;
  enabled: boolean;
  category: "print" | "finishing" | "addon";
  isCore?: boolean;
}

export type FinishingServiceType =
  | "spiral_binding"
  | "corner_staple"
  | "hard_binding"
  | "lamination"
  | string;

export type FinishingChargeUnit = "per_copy" | "per_sheet" | "per_document" | "flat";

export interface FinishingService {
  type: string;
  label: string;
  price: number;
  chargeUnit: FinishingChargeUnit;
  enabled: boolean;
}

export const DEFAULT_FINISHING_SERVICES: FinishingService[] = [
  { type: "spiral_binding", label: "Spiral Binding", price: 30, chargeUnit: "per_copy", enabled: false },
  { type: "corner_staple", label: "Corner Staple", price: 5, chargeUnit: "per_copy", enabled: false },
  { type: "hard_binding", label: "Hard Binding", price: 80, chargeUnit: "per_copy", enabled: false },
  { type: "lamination", label: "Lamination", price: 10, chargeUnit: "per_sheet", enabled: false },
];

export const DEFAULT_SHOP_SERVICES: ShopServiceItem[] = [
  { id: "core_bw", name: "Black & White Printing", price: 2, unit: "per_sheet", enabled: true, category: "print", isCore: true },
  { id: "core_color", name: "Color Printing", price: 10, unit: "per_sheet", enabled: true, category: "print", isCore: true },
  { id: "spiral_binding", name: "Spiral Binding", price: 30, unit: "per_copy", enabled: true, category: "finishing" },
  { id: "soft_binding", name: "Soft / Glue Binding", price: 40, unit: "per_copy", enabled: false, category: "finishing" },
  { id: "hard_binding", name: "Hard Binding (Project / Thesis)", price: 80, unit: "per_copy", enabled: false, category: "finishing" },
  { id: "lamination", name: "Document Lamination (A4)", price: 10, unit: "per_sheet", enabled: true, category: "finishing" },
  { id: "corner_staple", name: "Corner Stapling", price: 5, unit: "per_copy", enabled: true, category: "finishing" },
  { id: "glossy_photo", name: "Glossy Photo Paper", price: 15, unit: "per_sheet", enabled: false, category: "addon" },
  { id: "scan_to_device", name: "Document Scanning", price: 10, unit: "per_document", enabled: false, category: "addon" },
];

// ─── Shop Rate Card ───

export interface ShopRateCard {
  /** Price per B&W printed page in ₹ */
  priceBwPerPage: number;
  /** Price per Color printed page in ₹ */
  priceColorPerPage: number;
  /** Finishing services offered with custom pricing */
  finishingServices: FinishingService[];
}

export const DEFAULT_RATE_CARD: ShopRateCard = {
  priceBwPerPage: 2,
  priceColorPerPage: 10,
  finishingServices: [...DEFAULT_FINISHING_SERVICES],
};

// ─── Payment ───

export type PaymentMethod = "upi" | "cash";

export type PaymentStatus =
  | "pending"
  | "awaiting_cash_confirmation"
  | "confirmed"
  | "failed";

export interface PaymentInfo {
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  upiTransactionRef?: string;
}

// ─── Queue / Token ───

export type JobStatus =
  | "pending_payment"
  | "queued"
  | "printing"
  | "ready_for_pickup"
  | "picked_up"
  | "cancelled";

export interface QueueToken {
  /** Display code like "#214" */
  tokenCode: string;
  /** Optional legacy pickup PIN (deprecated: only single token number is used) */
  pickupPin?: string;
  /** Current position in queue (1-indexed) */
  queuePosition: number;
  /** Estimated wait in minutes */
  estimatedWaitMinutes: number;
}

// ─── Print Order (full session) ───

export interface PrintOrder {
  /** Unique order ID */
  id: string;
  /** Shop this order belongs to */
  shopId: string;
  /** WebRTC session ID */
  sessionId: string;
  /** All documents in this order */
  documents: UploadedDocument[];
  /** Selected finishing services */
  finishingServices: FinishingService[];
  /** Payment info */
  payment: PaymentInfo;
  /** Queue/token info (set after payment confirmation) */
  token?: QueueToken;
  /** Current job status */
  status: JobStatus;
  /** Timestamp of order creation */
  createdAt: string;
}

// ─── Price Calculation Helpers ───

/**
 * Calculates the number of physical sheets for a document
 * based on its settings (duplex, pages per sheet, page count).
 */
export function calculateSheets(pageCount: number, settings: PrintSettings): number {
  const logicalPages = Math.ceil(pageCount / settings.pagesPerSheet);
  const isDouble = settings.colorMode !== "color" && settings.duplex === "double";
  const sheets = isDouble
    ? Math.ceil(logicalPages / 2)
    : logicalPages;
  return sheets;
}

/**
 * Calculates the total price for a single document.
 */
export function calculateDocumentPrice(
  doc: UploadedDocument,
  rateCard: ShopRateCard
): number {
  const sheets = calculateSheets(doc.pageCount, doc.settings);
  const pricePerPage = doc.settings.colorMode === "color"
    ? rateCard.priceColorPerPage
    : rateCard.priceBwPerPage;
  return sheets * pricePerPage * doc.settings.copies;
}

/**
 * Calculates the finishing services cost for a single document.
 */
export function calculateFinishingCost(
  doc: UploadedDocument,
  activeFinishing: FinishingService[]
): number {
  const sheets = calculateSheets(doc.pageCount, doc.settings);
  let cost = 0;
  for (const service of activeFinishing) {
    if (service.chargeUnit === "per_sheet") {
      cost += service.price * sheets * doc.settings.copies;
    } else {
      cost += service.price * doc.settings.copies;
    }
  }
  return cost;
}

/**
 * Calculates total physical sheets for an entire order, accounting for
 * the unified image batch grid layout (where all images share sheets).
 */
export function calculateOrderSheets(documents: UploadedDocument[]): number {
  const nonImages = documents.filter((d) => d.type !== "image");
  const images = documents.filter((d) => d.type === "image");

  let totalSheets = 0;

  // Non-images (PDFs etc.) calculate sheets individually
  for (const doc of nonImages) {
    totalSheets += calculateSheets(doc.pageCount, doc.settings) * doc.settings.copies;
  }

  // All images combined calculate sheets based on their batch grid layout
  if (images.length > 0) {
    const firstImg = images[0];
    const grid = firstImg.settings.pagesPerSheet || 1;
    const logicalPages = Math.ceil(images.length / grid);
    const isDouble = firstImg.settings.colorMode !== "color" && firstImg.settings.duplex === "double";
    const sheetsPerCopy = isDouble
      ? Math.ceil(logicalPages / 2)
      : logicalPages;
    totalSheets += sheetsPerCopy * firstImg.settings.copies;
  }

  return totalSheets;
}

/**
 * Calculates the grand total for an entire order.
 */
export function calculateOrderTotal(
  documents: UploadedDocument[],
  rateCard: ShopRateCard,
  activeFinishing: FinishingService[]
): number {
  const nonImages = documents.filter((d) => d.type !== "image");
  const images = documents.filter((d) => d.type === "image");

  let total = 0;

  // 1. Non-image documents (calculated individually)
  for (const doc of nonImages) {
    total += calculateDocumentPrice(doc, rateCard);
    total += calculateFinishingCost(doc, activeFinishing);
  }

  // 2. Unified Image batch (all images share sheets based on grid layout)
  if (images.length > 0) {
    const firstImg = images[0];
    const grid = firstImg.settings.pagesPerSheet || 1;
    const logicalPages = Math.ceil(images.length / grid);
    const isDouble = firstImg.settings.colorMode !== "color" && firstImg.settings.duplex === "double";
    const sheetsPerCopy = isDouble
      ? Math.ceil(logicalPages / 2)
      : logicalPages;
    const totalSheets = sheetsPerCopy * firstImg.settings.copies;

    const pricePerPage = firstImg.settings.colorMode === "color"
      ? rateCard.priceColorPerPage
      : rateCard.priceBwPerPage;

    total += totalSheets * pricePerPage;

    for (const service of activeFinishing) {
      if (service.chargeUnit === "per_sheet") {
        total += service.price * totalSheets;
      } else {
        total += service.price * firstImg.settings.copies;
      }
    }
  }

  return total;
}

export const SESSION_STORAGE_KEY = (shopId: string) =>
  `printap_active_order_${shopId}`;

export interface PersistedSession {
  orderId: string;
  shopId: string;
  token: QueueToken;
  status: JobStatus;
  createdAt: string;
}

// ─── WebRTC Transfer Protocol Payloads ───

export interface TransferManifestOrder {
  tokenCode: string;
  pickupPin?: string;
  queuePosition: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  finishingServices?: { type: string; label: string; price: number }[];
  totalFiles: number;
}

export interface TransferManifestFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  settings: PrintSettings;
}

export interface TransferManifestMessage {
  type: "order-manifest";
  sessionId: string;
  order: TransferManifestOrder;
  files: TransferManifestFile[];
  printTicket?: string;
}

export interface TransferFileHeaderMessage {
  type: "file-header";
  sessionId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  pageCount: number;
  settings: PrintSettings;
}

export interface TransferFileEofMessage {
  type: "file-eof";
  sessionId: string;
  fileId: string;
}

export interface TransferOrderCompleteMessage {
  type: "order-complete";
  sessionId: string;
}

export type TransferMessage =
  | TransferManifestMessage
  | TransferFileHeaderMessage
  | TransferFileEofMessage
  | TransferOrderCompleteMessage;

// ─── Analytics & Archival System ───

export interface ShopDailyAnalytics {
  id: string;
  shop_id: string;
  analytics_date: string;
  total_orders: number;
  total_jobs: number;
  bw_pages: number;
  color_pages: number;
  gross_revenue: number;
  upi_revenue: number;
  cash_revenue: number;
  platform_fees: number;
  gst_amount: number;
  net_earnings: number;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformDailyAnalytics {
  analytics_date: string;
  active_shops_count: number;
  total_orders: number;
  total_jobs: number;
  total_volume_inr: number;
  total_platform_fees_inr: number;
  total_gst_inr: number;
  updated_at?: string;
}

export interface ArchiveAuditLog {
  id: string;
  month_identifier: string;
  cutoff_timestamp: string;
  orders_purged: number;
  events_purged: number;
  total_amount_inr: number;
  exported_by: string;
  status: string;
  created_at: string;
}

export interface MonthlyArchiveManifest {
  monthIdentifier: string;
  cutoffTimestamp: string;
  recordCount: number;
  totalAmountInr: number;
  localPath: string;
  exportedAt: string;
  files: string[];
}

