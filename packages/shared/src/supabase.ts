import { createClient, SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://pjwystvflmigolgtlpow.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqd3lzdHZmbG1pZ29sZ3RscG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODg1MTUsImV4cCI6MjEwNjE2NDUxNX0.iKjgSkyHJYQVnCkDgYPQHwwqykPJ_Ev7KQJhMiSkips";

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
  
  return DEFAULT_SUPABASE_URL;
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

  return DEFAULT_SUPABASE_ANON_KEY;
};

const SUPABASE_URL = getUrl() || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = getKey() || DEFAULT_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client configured with the project's
 * URL and anon key. Safe to call from both browser and Node.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn(
        "⚠️ [getSupabase] Warning: SUPABASE_URL or SUPABASE_ANON_KEY is not defined in current environment."
      );
    }
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    });
  }
  return client;
}
