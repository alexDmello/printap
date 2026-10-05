import { createClient, SupabaseClient } from "@supabase/supabase-js";

const getUrl = (): string => {
  // 1. Try Next.js process.env
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) {
    return process.env.VITE_SUPABASE_URL;
  }
  // 2. Try Vite import.meta.env (must be exactly import.meta.env.VITE_SUPABASE_URL for static replacement)
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
      // @ts-ignore
      return import.meta.env.VITE_SUPABASE_URL;
    }
  } catch (e) {}
  
  return "";
};

const getKey = (): string => {
  // 1. Try Next.js process.env
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  if (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) {
    return process.env.VITE_SUPABASE_ANON_KEY;
  }
  // 2. Try Vite import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
  } catch (e) {}

  return "";
};

const SUPABASE_URL = getUrl();
const SUPABASE_ANON_KEY = getKey();

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
