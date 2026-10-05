import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** CORS headers for cross-origin requests from Electron admin-desktop */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Helper to return JSON with CORS headers */
function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return jsonResponse({});
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const ADMIN_SECRET = process.env.PRINTAP_ADMIN_SECRET || "";

/**
 * POST /api/admin/offboard-shop
 * Body: { shop_id: string, admin_secret: string }
 *
 * Permanently offboards a shop:
 *  1. Tries the `admin_delete_shop` RPC (SECURITY DEFINER, handles auth.users)
 *  2. Falls back to manual cascade deletion of related rows + shop
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shop_id, admin_secret } = body;

    if (!shop_id || typeof shop_id !== "string") {
      return jsonResponse(
        { success: false, error: "Missing or invalid shop_id" },
        400
      );
    }

    // Simple admin secret check
    if (admin_secret !== ADMIN_SECRET) {
      return jsonResponse(
        { success: false, error: "Unauthorized" },
        401
      );
    }

    // Use service_role key if available, otherwise fall back to anon key
    const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 1. Fetch shop info ───────────────────────────────────────────
    const { data: shopData, error: shopFetchErr } = await supabase
      .from("shops")
      .select("*")
      .eq("id", shop_id)
      .maybeSingle();

    if (shopFetchErr || !shopData) {
      return jsonResponse(
        {
          success: false,
          error: shopFetchErr?.message || "Shop not found",
        },
        404
      );
    }

    const ownerEmail = shopData.owner_email || "";

    // ── 2. Try the SECURITY DEFINER RPC first ────────────────────────
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "admin_delete_shop",
      { p_shop_id: shop_id }
    );

    if (!rpcErr && rpcData?.success) {
      return jsonResponse({
        success: true,
        method: "rpc",
        details: rpcData,
      });
    }

    if (rpcErr) {
      console.warn(
        "[offboard-shop] RPC unavailable, falling back to manual delete:",
        rpcErr.message
      );
    }

    // ── 3. Fallback: manual cascade delete ───────────────────────────
    // Delete dependent rows (ignore errors for tables that may not exist)
    const tables = [
      { table: "print_events", column: "shop_id" },
      { table: "print_orders", column: "shop_id" },
      { table: "shop_daily_analytics", column: "shop_id" },
    ] as const;

    for (const { table, column } of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(column, shop_id);
      if (error) {
        console.warn(`[offboard-shop] Warning deleting from ${table}:`, error.message);
      }
    }

    // Delete email OTPs
    if (ownerEmail) {
      const { error } = await supabase
        .from("email_otps")
        .delete()
        .eq("email", ownerEmail.toLowerCase().trim());
      if (error) {
        console.warn("[offboard-shop] Warning deleting email_otps:", error.message);
      }
    }

    // If we have the service role key, purge from auth.users
    if (SUPABASE_SERVICE_ROLE_KEY && ownerEmail) {
      try {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const userToDelete = authUsers?.users?.find(
          (u) => u.email?.toLowerCase() === ownerEmail.toLowerCase().trim()
        );
        if (userToDelete) {
          await supabase.auth.admin.deleteUser(userToDelete.id);
          console.log("[offboard-shop] Purged auth user:", ownerEmail);
        }
      } catch (authErr) {
        console.warn("[offboard-shop] Could not purge auth user:", authErr);
      }
    }

    // Delete the shop row
    const { error: shopDelErr } = await supabase
      .from("shops")
      .delete()
      .eq("id", shop_id);

    if (shopDelErr) {
      return jsonResponse(
        {
          success: false,
          error: `Failed to delete shop: ${shopDelErr.message}. Ensure migration 012 has been applied.`,
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      method: "manual_cascade",
      deleted_shop_id: shop_id,
      shop_name: shopData.name,
      owner_email: ownerEmail,
    });
  } catch (err) {
    console.error("[offboard-shop] Unexpected error:", err);
    return jsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
}
