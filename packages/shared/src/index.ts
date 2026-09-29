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

export interface ShopInfo {
  id: string;
  name: string;
  slug?: string;
  upi_vpa: string;
  status: "active" | "suspended" | string;
  created_at: string;
}

