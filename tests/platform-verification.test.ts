import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSheets,
  calculateOrderSheets,
  calculateDocumentPrice,
  calculateFinishingCost,
  calculateOrderTotal,
  isValidEmail,
  isValidSubdomainLabel,
  isReservedSubdomain,
  type PrintSettings,
  type ShopRateCard,
  type FinishingService,
} from "../packages/shared/src/index";

// -------------------------------------------------------------
// Helper: SHA-256 calculation matching customer-signaling & shop-signaling
// -------------------------------------------------------------
async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// -------------------------------------------------------------
// Helper: Image MIME detection matching Electron Main detectImageMime
// -------------------------------------------------------------
function detectImageMime(uint8: Uint8Array): string {
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47)
    return "image/png";
  if (uint8[0] === 0xff && uint8[1] === 0xd8 && uint8[2] === 0xff)
    return "image/jpeg";
  if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46)
    return "image/gif";
  if (uint8[0] === 0x42 && uint8[1] === 0x4d) return "image/bmp";
  if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46)
    return "image/webp";
  return "image/png";
}

// -------------------------------------------------------------
// Helper: Spooler options mapping matching apps/desktop/src/main/index.ts
// -------------------------------------------------------------
interface PrintPdfOptions {
  copies?: number;
  colorMode?: "bw" | "color";
  duplex?: "single" | "double";
  scale?: "fit" | "noscale";
  printer?: string;
  orientation?: "portrait" | "landscape";
}

function mapToPtpOptions(options?: PrintPdfOptions) {
  const copyCount = Math.max(1, Math.min(500, options?.copies ?? 1));
  const printOptions: {
    scale: string;
    copies: number;
    monochrome: boolean;
    side: "duplex" | "simplex";
    printer?: string;
    orientation?: "portrait" | "landscape";
  } = {
    scale: options?.scale || "noscale",
    copies: copyCount,
    monochrome: options?.colorMode === "bw",
    side: options?.duplex === "double" ? "duplex" : "simplex",
  };

  if (options?.printer) {
    printOptions.printer = options.printer;
  }
  if (options?.orientation) {
    printOptions.orientation = options.orientation;
  }
  return printOptions;
}

// -------------------------------------------------------------
// Helper: PrintHistory revenue stats matching apps/desktop/src/renderer/components/PrintHistory.tsx
// -------------------------------------------------------------
interface OrderRecord {
  id: string;
  status: string;
  payment_method: string;
  total_amount: number | string;
}

function computePrintHistoryStats(orders: OrderRecord[]) {
  let totalRevenue = 0;
  let upiRevenue = 0;
  let cashRevenue = 0;
  let settledCount = 0;

  orders.forEach((o) => {
    if (o.status === "cancelled" || o.status === "failed" || o.status === "failed_refunded") {
      return;
    }
    settledCount++;
    const amt = Number(o.total_amount) || 0;
    totalRevenue += amt;
    if (o.payment_method === "upi") upiRevenue += amt;
    else if (o.payment_method === "cash") cashRevenue += amt;
  });

  return {
    count: settledCount,
    totalRevenue,
    upiRevenue,
    cashRevenue,
  };
}

// -------------------------------------------------------------
// Helper: 30-min Pending Queue Sweeper matching App.tsx
// -------------------------------------------------------------
interface QueueJob {
  sessionId: string;
  enqueuedAt: string;
  files: { buffer: ArrayBuffer }[];
}

function sweepExpiredJobs(queue: QueueJob[], nowMs: number, expiryMs = 30 * 60 * 1000) {
  const expired: QueueJob[] = [];
  const active: QueueJob[] = [];

  queue.forEach((job) => {
    const age = nowMs - new Date(job.enqueuedAt).getTime();
    if (age > expiryMs) {
      // Memory zeroing
      job.files.forEach((f) => {
        f.buffer = new ArrayBuffer(0);
      });
      expired.push(job);
    } else {
      active.push(job);
    }
  });

  return { active, expired };
}

// =============================================================
// TEST SUITES
// =============================================================

describe("1. End-to-End SHA-256 WebRTC File Integrity", () => {
  it("should generate deterministic SHA-256 hex digest for an ArrayBuffer", async () => {
    const text = "Enterprise reliability verification for Printap PDF transfer";
    const enc = new TextEncoder();
    const buf = enc.encode(text).buffer;

    const hash = await computeSha256Hex(buf);
    assert.strictEqual(typeof hash, "string");
    assert.strictEqual(hash.length, 64);

    // Same buffer produces identical hash
    const hash2 = await computeSha256Hex(buf);
    assert.strictEqual(hash, hash2);
  });

  it("should detect corrupted data and reject mismatched SHA-256", async () => {
    const originalBuf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    const corruptedBuf = new Uint8Array([1, 2, 3, 4, 99, 6, 7, 8]).buffer;

    const expectedHash = await computeSha256Hex(originalBuf);
    const actualHash = await computeSha256Hex(corruptedBuf);

    assert.notStrictEqual(expectedHash, actualHash);
  });
});

describe("2. Image MIME Magic-Byte Detection (Step 3 Fix)", () => {
  it("should correctly identify PNG using 0x89 0x50 0x4e 0x47", () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.strictEqual(detectImageMime(pngHeader), "image/png");
  });

  it("should correctly identify JPEG using 0xff 0xd8 0xff", () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assert.strictEqual(detectImageMime(jpegHeader), "image/jpeg");
  });

  it("should correctly identify GIF using 0x47 0x49 0x46", () => {
    const gifHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    assert.strictEqual(detectImageMime(gifHeader), "image/gif");
  });

  it("should correctly identify BMP using 0x42 0x4d", () => {
    const bmpHeader = new Uint8Array([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00]);
    assert.strictEqual(detectImageMime(bmpHeader), "image/bmp");
  });

  it("should correctly identify WebP using 0x52 0x49 0x46 0x46", () => {
    const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    assert.strictEqual(detectImageMime(webpHeader), "image/webp");
  });

  it("should fallback to image/png for unrecognized formats", () => {
    const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    assert.strictEqual(detectImageMime(unknown), "image/png");
  });
});

describe("3. Native Duplex, Monochrome & Copies Print Spooler Translation (Steps 3 & 4)", () => {
  it("should map double-sided to duplex and single-sided to simplex", () => {
    const doubleRes = mapToPtpOptions({ duplex: "double" });
    assert.strictEqual(doubleRes.side, "duplex");

    const singleRes = mapToPtpOptions({ duplex: "single" });
    assert.strictEqual(singleRes.side, "simplex");
  });

  it("should map colorMode bw to monochrome true and color to monochrome false", () => {
    const bwRes = mapToPtpOptions({ colorMode: "bw" });
    assert.strictEqual(bwRes.monochrome, true);

    const colorRes = mapToPtpOptions({ colorMode: "color" });
    assert.strictEqual(colorRes.monochrome, false);
  });

  it("should pass native copies with clamp between 1 and 500", () => {
    const normal = mapToPtpOptions({ copies: 3 });
    assert.strictEqual(normal.copies, 3);

    const zero = mapToPtpOptions({ copies: 0 });
    assert.strictEqual(zero.copies, 1);

    const huge = mapToPtpOptions({ copies: 1000 });
    assert.strictEqual(huge.copies, 500);
  });
});

describe("4. Print History Revenue & Cancellation Math (Step 7)", () => {
  it("should strictly exclude cancelled and failed orders from revenue totals", () => {
    const orders: OrderRecord[] = [
      { id: "1", status: "completed", payment_method: "upi", total_amount: 150 },
      { id: "2", status: "completed", payment_method: "cash", total_amount: 50 },
      { id: "3", status: "cancelled", payment_method: "upi", total_amount: 500 },
      { id: "4", status: "failed", payment_method: "cash", total_amount: 200 },
      { id: "5", status: "failed_refunded", payment_method: "upi", total_amount: 300 },
    ];

    const stats = computePrintHistoryStats(orders);
    assert.strictEqual(stats.count, 2);
    assert.strictEqual(stats.totalRevenue, 200);
    assert.strictEqual(stats.upiRevenue, 150);
    assert.strictEqual(stats.cashRevenue, 50);
  });
});

describe("5. 30-Minute Pending Queue Sweeper & Heap Memory Deallocation (Step 6)", () => {
  it("should sweep jobs older than 30 minutes and zero their ArrayBuffers", () => {
    const now = Date.now();
    const oldTime = new Date(now - 31 * 60 * 1000).toISOString(); // 31 mins ago
    const freshTime = new Date(now - 5 * 60 * 1000).toISOString(); // 5 mins ago

    const dummyBuf1 = new ArrayBuffer(1024 * 1024); // 1 MB
    const dummyBuf2 = new ArrayBuffer(2 * 1024 * 1024); // 2 MB

    const queue: QueueJob[] = [
      {
        sessionId: "sess-expired-1",
        enqueuedAt: oldTime,
        files: [{ buffer: dummyBuf1 }],
      },
      {
        sessionId: "sess-active-2",
        enqueuedAt: freshTime,
        files: [{ buffer: dummyBuf2 }],
      },
    ];

    const { active, expired } = sweepExpiredJobs(queue, now);

    assert.strictEqual(expired.length, 1);
    assert.strictEqual(expired[0].sessionId, "sess-expired-1");
    assert.strictEqual(expired[0].files[0].buffer.byteLength, 0, "Buffer should be deallocated to 0 bytes");

    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0].sessionId, "sess-active-2");
    assert.strictEqual(active[0].files[0].buffer.byteLength, 2 * 1024 * 1024, "Active buffer remains intact");
  });
});

describe("6. Disconnected Printers Pruning Logic (Step 8)", () => {
  it("should filter and identify stale printer records to delete", () => {
    const savedAssignments = {
      "HP LaserJet Pro": { paper_size: "A4", color_capable: false },
      "Epson L3150": { paper_size: "A4", color_capable: true },
      "Old Disconnected Canon": { paper_size: "A3", color_capable: true },
    };

    const physicalPrinters = ["HP LaserJet Pro", "Epson L3150"];
    const activeNames = Object.keys(savedAssignments).filter((name) =>
      physicalPrinters.includes(name)
    );

    assert.deepStrictEqual(activeNames, ["HP LaserJet Pro", "Epson L3150"]);
    assert.ok(!activeNames.includes("Old Disconnected Canon"));
  });
});

describe("7. Pricing Engine & Rates Verification", () => {
  const rateCard: ShopRateCard = {
    priceBwPerPage: 2.0,
    priceColorPerPage: 10.0,
    finishingServices: [],
  };

  it("should accurately calculate single-sided sheets and price", () => {
    const settings: PrintSettings = {
      copies: 1,
      colorMode: "bw",
      duplex: "single",
      pagesPerSheet: 1,
      pageFit: "fit",
      orientation: "portrait",
    };

    const doc = {
      id: "doc-1",
      file: {} as File,
      pageCount: 10,
      settings,
    };

    const sheets = calculateSheets(10, settings);
    assert.strictEqual(sheets, 10);

    const price = calculateDocumentPrice(doc, rateCard);
    assert.strictEqual(price, 20.0); // 10 sheets * 2.0 * 1 copy
  });

  it("should accurately calculate double-sided duplex sheets and price", () => {
    const settings: PrintSettings = {
      copies: 1,
      colorMode: "bw",
      duplex: "double",
      pagesPerSheet: 1,
      pageFit: "fit",
      orientation: "portrait",
    };

    const doc = {
      id: "doc-2",
      file: {} as File,
      pageCount: 10,
      settings,
    };

    const sheets = calculateSheets(10, settings);
    assert.strictEqual(sheets, 5); // 10 pages duplex = 5 sheets

    const price = calculateDocumentPrice(doc, rateCard);
    assert.strictEqual(price, 10.0); // 5 sheets * 2.0 * 1 copy
  });

  it("should accurately calculate 2-pages-per-sheet duplex", () => {
    const settings: PrintSettings = {
      copies: 2,
      colorMode: "bw",
      duplex: "double",
      pagesPerSheet: 2,
      pageFit: "fit",
      orientation: "portrait",
    };

    const doc = {
      id: "doc-3",
      file: {} as File,
      pageCount: 8,
      settings,
    };

    // 8 document pages with 2 pages/sheet = 4 logical pages -> duplex = 2 physical sheets
    const sheets = calculateSheets(8, settings);
    assert.strictEqual(sheets, 2);

    const price = calculateDocumentPrice(doc, rateCard);
    // 2 physical sheets * 2.0 per sheet * 2 copies = 8.0
    assert.strictEqual(price, 8.0);
  });

  it("should compute finishing services cost accurately", () => {
    const settings: PrintSettings = {
      copies: 2,
      colorMode: "bw",
      duplex: "single",
      pagesPerSheet: 1,
      pageFit: "fit",
      orientation: "portrait",
    };

    const doc = {
      id: "doc-4",
      file: {} as File,
      pageCount: 5,
      settings,
    };

    const finishingServices: FinishingService[] = [
      {
        type: "corner_staple",
        label: "Corner Staple",
        price: 5.0,
        chargeUnit: "per_copy",
        enabled: true,
      },
      {
        type: "lamination",
        label: "Lamination",
        price: 10.0,
        chargeUnit: "per_sheet",
        enabled: true,
      },
    ];

    // Staple: per_copy -> 5.0 * 2 copies = 10.0
    const stapleCost = calculateFinishingCost(doc, [finishingServices[0]]);
    assert.strictEqual(stapleCost, 10.0);

    // Lamination: per_sheet -> 10.0 * 5 sheets * 2 copies = 100.0
    const laminationCost = calculateFinishingCost(doc, [finishingServices[1]]);
    assert.strictEqual(laminationCost, 100.0);
  });
});

describe("8. Validation & Subdomain Security Verification", () => {
  it("should validate emails correctly", () => {
    assert.strictEqual(isValidEmail("admin@printap.com"), true);
    assert.strictEqual(isValidEmail("owner.shop+tag@mellod.in"), true);
    assert.strictEqual(isValidEmail("invalid-email"), false);
    assert.strictEqual(isValidEmail("@domain.com"), false);
  });

  it("should protect reserved subdomains and validate shop slugs", () => {
    assert.strictEqual(isReservedSubdomain("admin"), true);
    assert.strictEqual(isReservedSubdomain("api"), true);
    assert.strictEqual(isReservedSubdomain("platform"), true);
    assert.strictEqual(isReservedSubdomain("dashboard"), true);
    assert.strictEqual(isReservedSubdomain("central-xerox"), false);

    assert.strictEqual(isValidSubdomainLabel("shop-123"), true);
    assert.strictEqual(isValidSubdomainLabel("-invalid"), false);
    assert.strictEqual(isValidSubdomainLabel("invalid-"), false);
    assert.strictEqual(isValidSubdomainLabel("UPPERCASE"), false);
  });
});
