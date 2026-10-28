import type { ShopInfo } from "@printap/shared";

export interface ExtendedShop extends ShopInfo {
  printCount?: number;
  revenueGenerated?: number;
  owner_email?: string;
  owner_name?: string;
  owner_phone?: string;
}

export interface GlobalPrintEvent {
  id: string;
  shop_id: string;
  session_id: string;
  created_at: string;
  shop_name?: string;
  shop_slug?: string;
}

export type NavigationTab =
  | "overview"
  | "analytics"
  | "shops"
  | "ledger"
  | "health";

export type DateRangeOption = "7d" | "30d" | "90d" | "all";

export interface LeaderboardItem {
  shopId: string;
  shopName: string;
  slug?: string;
  status: string;
  printCount: number;
  percentageOfTotal: number;
}

export interface DailyVolumePoint {
  dateKey: string;
  label: string;
  fullDate: string;
  printCount: number;
  revenue: number;
}
