// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase service environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Stale threshold: 90 seconds (desktop heartbeat runs every 30s)
    const staleThreshold = new Date(Date.now() - 90 * 1000).toISOString();

    const { data: updated, error } = await supabase
      .from("shops")
      .update({ is_online: false })
      .eq("is_online", true)
      .lt("last_seen_at", staleThreshold)
      .select("id, name, last_seen_at");

    if (error) {
      console.error("[cleanup-stale-presence] Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[cleanup-stale-presence] Swept ${updated?.length ?? 0} stale shop(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        sweptCount: updated?.length ?? 0,
        sweptShops: updated,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
