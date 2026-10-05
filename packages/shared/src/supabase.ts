import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = 
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL : "") || 
  (typeof import.meta !== "undefined" && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_URL : "") || "";

const SUPABASE_ANON_KEY = 
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY : "") || 
  (typeof import.meta !== "undefined" && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY : "") || "";

let client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client configured with the project's
 * URL and anon key. Safe to call from both browser and Node.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    });
  }
  return client;
}
