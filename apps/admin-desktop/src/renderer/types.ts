import type { ShopInfo } from "@printap/shared";

export interface ExtendedShop extends ShopInfo {
  printCount?: number;
  revenueGenerated?: number;
}

export interface GlobalPrintEvent {
  id: string;
  shop_id: string;
  session_id: string;
  fee_amount: number;
  created_at: string;
  shop_name?: string;
  shop_slug?: string;
}

export type NavigationTab =
  | "overview"
  | "analytics"
  | "shops"
  | "ledger"
  | "pricing"
  | "health";

export type DateRangeOption = "7d" | "30d" | "90d" | "all";

export interface LeaderboardItem {
  shopId: string;
  shopName: string;
  slug?: string;
  status: string;
  printCount: number;
  feeContribution: number;
  percentageOfTotal: number;
}

export interface DailyVolumePoint {
  dateKey: string;
  label: string;
  fullDate: string;
  printCount: number;
  revenue: number;
}
