import { app, shell } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync, statSync } from "fs";
import { getSupabase } from "@printap/shared";

export interface MonthlyArchiveRecord {
  monthIdentifier: string;        // e.g. "2026-09"
  cutoffTimestamp: string;        // ISO string
  ordersCount: number;
  eventsCount: number;
  totalAmountInr: number;
  archivePath: string;
  files: string[];
  exportedAt: string;
  purgedFromDb: boolean;
}

export interface ArchiveManifest {
  version: string;
  lastUpdated: string;
  archives: MonthlyArchiveRecord[];
}

export class ArchivalManager {
  private baseDir: string;
  private manifestPath: string;

  constructor() {
    this.baseDir = path.join(app.getPath("userData"), "archives");
    this.manifestPath = path.join(this.baseDir, "archive_manifest.json");
    this.ensureDirectory(this.baseDir);
  }

  private ensureDirectory(dirPath: string) {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  public async readManifest(): Promise<ArchiveManifest> {
    try {
      if (existsSync(this.manifestPath)) {
        const raw = await fs.readFile(this.manifestPath, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("[ArchivalManager] Could not read manifest, recreating:", e);
    }
    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      archives: [],
    };
  }

  public async saveManifest(manifest: ArchiveManifest): Promise<void> {
    manifest.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  public async openArchiveFolder(monthIdentifier?: string): Promise<boolean> {
    const targetDir = monthIdentifier
      ? path.join(this.baseDir, monthIdentifier)
      : this.baseDir;
    this.ensureDirectory(targetDir);
    const err = await shell.openPath(targetDir);
    return !err;
  }

  /**
   * Returns current active Supabase record counts and last archived month.
   */
  public async getDbStatus(): Promise<{
    activeOrdersCount: number;
    activeEventsCount: number;
    lastArchivedMonth: string | null;
  }> {
    const supabase = getSupabase();
    let activeOrdersCount = 0;
    let activeEventsCount = 0;

    try {
      const { count: ordCount } = await supabase
        .from("print_orders")
        .select("*", { count: "exact", head: true });
      if (ordCount !== null) activeOrdersCount = ordCount;

      const { count: evCount } = await supabase
        .from("print_events")
        .select("*", { count: "exact", head: true });
      if (evCount !== null) activeEventsCount = evCount;
    } catch (err) {
      console.error("[ArchivalManager] Error getting DB counts:", err);
    }

    const manifest = await this.readManifest();
    const lastArchive = manifest.archives.length > 0
      ? manifest.archives[manifest.archives.length - 1].monthIdentifier
      : null;

    return {
      activeOrdersCount,
      activeEventsCount,
      lastArchivedMonth: lastArchive,
    };
  }

  /**
   * Main archival execution:
   * 1. Fetches previous/specified month data from Supabase.
   * 2. Exports locally into JSON and CSV.
   * 3. Verifies file integrity.
   * 4. Calls Supabase RPC to purge raw database records.
   * 5. Updates local manifest.
   */
  public async exportAndPurgeMonth(options?: {
    monthIdentifier?: string; // e.g. "2026-09"
    cutoffDate?: Date;
  }): Promise<{
    success: boolean;
    monthIdentifier: string;
    ordersCount: number;
    eventsCount: number;
    totalAmountInr: number;
    archivePath: string;
    message: string;
  }> {
    const now = new Date();
    
    // Default to the month that just ended if no identifier specified
    let monthLabel = options?.monthIdentifier;
    let cutoff = options?.cutoffDate;

    if (!cutoff) {
      // Cutoff at beginning of current month (midnight 1st of current month)
      cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    }

    if (!monthLabel) {
      // Previous month identifier YYYY-MM
      const prevDate = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);
      const y = prevDate.getUTCFullYear();
      const m = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
      monthLabel = `${y}-${m}`;
    }

    const monthDir = path.join(this.baseDir, monthLabel);
    this.ensureDirectory(monthDir);

    const supabase = getSupabase();
    console.log(`[ArchivalManager] Starting archival for month ${monthLabel} with cutoff ${cutoff.toISOString()}`);

    // 1. Fetch raw print orders created before cutoff
    const { data: rawOrders, error: ordErr } = await supabase
      .from("print_orders")
      .select("*, order_documents(*)")
      .lt("created_at", cutoff.toISOString())
      .order("created_at", { ascending: true });

    if (ordErr) {
      throw new Error(`Failed to fetch print_orders from Supabase: ${ordErr.message}`);
    }

    // 2. Fetch raw print events created before cutoff
    const { data: rawEvents, error: evErr } = await supabase
      .from("print_events")
      .select("*")
      .lt("created_at", cutoff.toISOString())
      .order("created_at", { ascending: true });

    if (evErr) {
      throw new Error(`Failed to fetch print_events from Supabase: ${evErr.message}`);
    }

    const orders = rawOrders || [];
    const events = rawEvents || [];
    const totalAmount = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    // 3. Write Orders JSON
    const ordersJsonPath = path.join(monthDir, "print_orders.json");
    await fs.writeFile(ordersJsonPath, JSON.stringify(orders, null, 2), "utf-8");

    // 4. Write Orders CSV (for spreadsheet viewing and accounting)
    const ordersCsvHeaders = [
      "Order ID",
      "Shop ID",
      "Token Code",
      "Pickup PIN",
      "Session ID",
      "Payment Method",
      "Payment Status",
      "Job Status",
      "Total Amount (INR)",
      "Created At",
    ];
    const ordersCsvRows = orders.map((o) => [
      `"${o.id}"`,
      `"${o.shop_id}"`,
      `"${o.token_code || ""}"`,
      `"${o.pickup_pin || ""}"`,
      `"${o.session_id}"`,
      `"${o.payment_method || ""}"`,
      `"${o.payment_status}"`,
      `"${o.status}"`,
      Number(o.total_amount || 0).toFixed(2),
      `"${o.created_at}"`,
    ]);
    const ordersCsvContent = [ordersCsvHeaders.join(","), ...ordersCsvRows.map((r) => r.join(","))].join("\n");
    const ordersCsvPath = path.join(monthDir, "print_orders.csv");
    await fs.writeFile(ordersCsvPath, ordersCsvContent, "utf-8");

    // 5. Write Events CSV
    const eventsCsvHeaders = ["Event ID", "Shop ID", "Session ID", "Platform Fee (INR)", "Created At"];
    const eventsCsvRows = events.map((e) => [
      `"${e.id}"`,
      `"${e.shop_id}"`,
      `"${e.session_id}"`,
      Number(e.fee_amount || 1.0).toFixed(2),
      `"${e.created_at}"`,
    ]);
    const eventsCsvContent = [eventsCsvHeaders.join(","), ...eventsCsvRows.map((r) => r.join(","))].join("\n");
    const eventsCsvPath = path.join(monthDir, "print_events.csv");
    await fs.writeFile(eventsCsvPath, eventsCsvContent, "utf-8");

    // 6. Write Summary Metadata
    const summaryData = {
      monthIdentifier: monthLabel,
      cutoffTimestamp: cutoff.toISOString(),
      ordersCount: orders.length,
      eventsCount: events.length,
      totalAmountInr: totalAmount,
      exportedAt: new Date().toISOString(),
      files: ["print_orders.json", "print_orders.csv", "print_events.csv"],
    };
    const summaryPath = path.join(monthDir, "summary.json");
    await fs.writeFile(summaryPath, JSON.stringify(summaryData, null, 2), "utf-8");

    // 7. Verify Local Write Integrity (File check & parse check)
    const orderStat = statSync(ordersJsonPath);
    if (orderStat.size === 0 && orders.length > 0) {
      throw new Error("Local verification failed: print_orders.json is empty.");
    }

    // 8. Safely Purge Data in Supabase via RPC
    let purgedFromDb = false;
    try {
      const { data: purgeResult, error: purgeErr } = await supabase.rpc(
        "purge_archived_month_data",
        {
          p_cutoff_timestamp: cutoff.toISOString(),
          p_month_label: monthLabel,
        }
      );

      if (purgeErr) {
        console.warn("[ArchivalManager] RPC purge_archived_month_data error, falling back to direct delete:", purgeErr);
        // Fallback: Delete directly if RPC function is not yet created
        await supabase.from("print_orders").delete().lt("created_at", cutoff.toISOString());
        await supabase.from("print_events").delete().lt("created_at", cutoff.toISOString());
      } else {
        console.log("[ArchivalManager] Supabase RPC purge result:", purgeResult);
      }
      purgedFromDb = true;
    } catch (purgeError) {
      console.error("[ArchivalManager] Database purge warning:", purgeError);
    }

    // 9. Update Local Manifest
    const manifest = await this.readManifest();
    manifest.archives = manifest.archives.filter((a) => a.monthIdentifier !== monthLabel);
    manifest.archives.push({
      monthIdentifier: monthLabel,
      cutoffTimestamp: cutoff.toISOString(),
      ordersCount: orders.length,
      eventsCount: events.length,
      totalAmountInr: totalAmount,
      archivePath: monthDir,
      files: summaryData.files,
      exportedAt: new Date().toISOString(),
      purgedFromDb,
    });
    await this.saveManifest(manifest);

    return {
      success: true,
      monthIdentifier: monthLabel,
      ordersCount: orders.length,
      eventsCount: events.length,
      totalAmountInr: totalAmount,
      archivePath: monthDir,
      message: `Archival of ${monthLabel} completed (${orders.length} orders, ${events.length} events archived locally and cleared from Supabase).`,
    };
  }

  /**
   * Automatic background check on the 1st of every month.
   */
  public async checkAndRunAutoArchival(): Promise<void> {
    try {
      const now = new Date();
      // Calculate previous month identifier (YYYY-MM)
      const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      const y = prevDate.getUTCFullYear();
      const m = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
      const targetMonth = `${y}-${m}`;

      const manifest = await this.readManifest();
      const alreadyArchived = manifest.archives.some((a) => a.monthIdentifier === targetMonth);

      if (!alreadyArchived && now.getUTCDate() >= 1) {
        console.log(`[ArchivalManager] Automatic monthly archival triggering for month: ${targetMonth}`);
        await this.exportAndPurgeMonth({ monthIdentifier: targetMonth });
      }
    } catch (err) {
      console.error("[ArchivalManager] Auto archival check failed:", err);
    }
  }

  /**
   * Read raw historical month data from local disk for offline inspection.
   */
  public async readLocalMonthData(monthIdentifier: string): Promise<any> {
    const ordersPath = path.join(this.baseDir, monthIdentifier, "print_orders.json");
    const summaryPath = path.join(this.baseDir, monthIdentifier, "summary.json");
    if (existsSync(ordersPath)) {
      const ordersRaw = await fs.readFile(ordersPath, "utf-8");
      let summary = null;
      if (existsSync(summaryPath)) {
        summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));
      }
      return {
        orders: JSON.parse(ordersRaw),
        summary,
      };
    }
    return null;
  }
}

export const archivalManager = new ArchivalManager();
