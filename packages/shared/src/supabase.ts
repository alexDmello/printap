import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pjwystvflmigolgtlpow.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqd3lzdHZmbG1pZ29sZ3RscG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODg1MTUsImV4cCI6MjEwNjE2NDUxNX0.iKjgSkyHJYQVnCkDgYPQHwwqykPJ_Ev7KQJhMiSkips";

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
