/**
 * FIFO Print Dispatcher & Local Atomic Token Allocator
 *
 * Responsibilities:
 * 1. 100% Local Atomic Token Allocation (zero database dependency, collision-free)
 * 2. FIFO Order Queue: Jobs are processed in the strict order they arrive
 * 3. Multi-Printer Capability Load Balancing:
 *    - Divides tasks across all active compatible printers (B&W vs. Color)
 *    - Allows concurrent printing across multiple physical printers
 *    - Falls back gracefully if printers are busy or disabled
 */

import type { PrintSettings } from "@printap/shared";
import type { PrinterAssignment } from "../components/PrintersControl";

export interface ReceivedJobFile {
  fileId?: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  settings: PrintSettings;
  buffer: ArrayBuffer;
}

export interface QueuedPrintJob {
  sessionId: string;
  tokenCode: string;
  printerNumber: number;
  targetPrinterName?: string;
  hasColor: boolean;
  files: ReceivedJobFile[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  enqueuedAt: Date;
}

export interface PrinterWorkerStatus {
  printerName: string;
  printerNumber: number;
  role: "bw" | "color" | "both" | "disabled";
  isBusy: boolean;
  currentJobToken?: string;
  currentSessionId?: string;
  jobsCompleted: number;
}

export interface TokenAllocation {
  tokenCode: string;
  printerNumber: number;
  targetPrinterName?: string;
  queuePosition: number;
}

export interface DispatcherCallbacks {
  onJobStarted?: (job: QueuedPrintJob, printerName: string) => void;
  onJobFileProgress?: (
    sessionId: string,
    fileName: string,
    fileIndex: number,
    totalFiles: number,
    printerName: string
  ) => void;
  onJobCompleted?: (job: QueuedPrintJob, printerName: string) => void;
  onJobFailed?: (job: QueuedPrintJob, error: string, printerName: string) => void;
  onQueueUpdated?: (
    queuedJobs: QueuedPrintJob[],
    workers: PrinterWorkerStatus[]
  ) => void;
}

export class FifoPrintDispatcher {
  private queue: QueuedPrintJob[] = [];
  private allocatedTokens: Map<string, TokenAllocation> = new Map();
  private failedJobs: Map<string, QueuedPrintJob> = new Map();
  private printerWorkers: Map<
    string,
    {
      isBusy: boolean;
      currentJobToken?: string;
      currentSessionId?: string;
      jobsCompleted: number;
    }
  > = new Map();

  private dailySequence: number = 0;
  private currentDateStr: string = "";
  private shopId: string = "";
  private callbacks: DispatcherCallbacks = {};

  constructor(shopId: string, initialPrintsCount: number = 0) {
    this.shopId = shopId;
    this.initSequence(initialPrintsCount);
  }

  public setCallbacks(callbacks: DispatcherCallbacks): void {
    this.callbacks = callbacks;
  }

  public setShopId(shopId: string, initialPrintsCount: number = 0): void {
    this.shopId = shopId;
    this.initSequence(initialPrintsCount);
  }

  /**
   * Initializes local token sequence from date & localStorage or initial count.
   */
  private initSequence(initialCount: number = 0): void {
    const today = new Date().toDateString();
    this.currentDateStr = today;

    const storageKey = `printap_local_seq_${this.shopId || "default"}_${today}`;
    const saved = localStorage.getItem(storageKey);

    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      const higher = Number.isFinite(parsed)
        ? Math.max(parsed, initialCount, this.dailySequence)
        : Math.max(initialCount, this.dailySequence);
      this.dailySequence = higher;
    } else {
      this.dailySequence = Math.max(this.dailySequence, initialCount);
      try {
        localStorage.setItem(storageKey, String(this.dailySequence));
      } catch {}
    }
  }

  /**
   * Synchronize the local sequence with the highest known sequence count
   * from the database and existing orders. Ensures we never jump backwards.
   */
  public syncSequence(highestKnownSequence: number): void {
    this.checkDayRollover();
    if (highestKnownSequence > this.dailySequence) {
      this.dailySequence = highestKnownSequence;
      const storageKey = `printap_local_seq_${this.shopId || "default"}_${this.currentDateStr}`;
      try {
        localStorage.setItem(storageKey, String(this.dailySequence));
      } catch {}
      console.log(
        `[FifoDispatcher] Synchronized daily token sequence forward to ${this.dailySequence}`
      );
    }
  }

  /**
   * Helper to parse and sync sequence numbers from today's order history.
   */
  public syncFromOrders(orders: Array<{ token_code?: string | null }>): void {
    let maxSeq = 0;
    for (const order of orders) {
      if (!order.token_code) continue;
      const clean = order.token_code.replace(/^#/, "");
      // Format #{printerNumber}{dailySequence}, e.g. "17" -> printer 1, sequence 7
      if (/^\d{2,}$/.test(clean)) {
        const seq = parseInt(clean.slice(1), 10);
        if (Number.isFinite(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      } else {
        const num = parseInt(clean, 10);
        if (Number.isFinite(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    const targetSeq = maxSeq > 0 ? maxSeq : orders.length;
    this.syncSequence(targetSeq);
  }

  /**
   * Check and reset calendar day rollover.
   */
  private checkDayRollover(): void {
    const today = new Date().toDateString();
    if (today !== this.currentDateStr) {
      this.currentDateStr = today;
      this.dailySequence = 0;
      this.allocatedTokens.clear();
      const storageKey = `printap_local_seq_${this.shopId || "default"}_${today}`;
      try {
        localStorage.setItem(storageKey, "0");
      } catch {}
      console.log(`[FifoDispatcher] Day rolled over to ${today}, local token counter reset to 0`);
    }
  }

  /**
   * Atomically allocate the next local token without any database call.
   * Format: #{printerNumber}{dailySequence} (e.g. #11, #22, #13)
   */
  public allocateToken(
    sessionId: string,
    hasColor: boolean,
    assignments: Record<string, PrinterAssignment>
  ): TokenAllocation {
    this.checkDayRollover();

    // If this session already has an allocated token, return it
    const existing = this.allocatedTokens.get(sessionId);
    if (existing) {
      return existing;
    }

    // Atomically increment local counter
    this.dailySequence += 1;
    const storageKey = `printap_local_seq_${this.shopId || "default"}_${this.currentDateStr}`;
    try {
      localStorage.setItem(storageKey, String(this.dailySequence));
    } catch {
      // ignore localStorage quota errors
    }

    // Find compatible printer for the token prefix
    const compatiblePrinter = this.findBestCompatiblePrinter(hasColor, assignments);
    const printerNumber = compatiblePrinter?.printer_number || 1;
    const targetPrinterName = compatiblePrinter?.printer_name;

    const tokenCode = `#${printerNumber}${this.dailySequence}`;
    const queuePosition = this.getEstimatedQueuePosition();

    const allocation: TokenAllocation = {
      tokenCode,
      printerNumber,
      targetPrinterName,
      queuePosition,
    };

    this.allocatedTokens.set(sessionId, allocation);
    console.log(
      `[FifoDispatcher] Atomically allocated local token: ${tokenCode} (seq: ${this.dailySequence}) for session ${sessionId.slice(0, 8)}`
    );

    return allocation;
  }

  /**
   * Retrieve an already allocated token if present.
   */
  public getAllocatedToken(sessionId: string): TokenAllocation | undefined {
    return this.allocatedTokens.get(sessionId);
  }

  /**
   * Enqueue a job into the FIFO print queue.
   */
  public enqueue(
    job: QueuedPrintJob,
    assignments: Record<string, PrinterAssignment>
  ): void {
    // Avoid duplicate enqueues for the same session
    if (this.queue.some((q) => q.sessionId === job.sessionId)) {
      console.warn(`[FifoDispatcher] Session ${job.sessionId} already in queue`);
      return;
    }

    console.log(
      `[FifoDispatcher] Enqueued job: Token ${job.tokenCode}, ${job.files.length} files (hasColor: ${job.hasColor}). Queue depth: ${this.queue.length + 1}`
    );

    this.queue.push(job);
    this.notifyQueueUpdate(assignments);

    // Trigger FIFO processing immediately
    this.processQueue(assignments);
  }

  /**
   * Updates payment status of a job if it is currently in queue.
   */
  public updateJobPaymentStatus(
    sessionId: string, 
    paymentStatus: string,
    assignments?: Record<string, PrinterAssignment>
  ): void {
    const job = this.queue.find((q) => q.sessionId === sessionId);
    if (job) {
      job.paymentStatus = paymentStatus;
      if (assignments) {
        this.processQueue(assignments);
      }
    }
  }

  /**
   * Cancels a pending job from the queue.
   */
  public cancelJob(sessionId: string, assignments: Record<string, PrinterAssignment>): void {
    const index = this.queue.findIndex((q) => q.sessionId === sessionId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.notifyQueueUpdate(assignments);
      console.log(`[FifoDispatcher] Cancelled job for session ${sessionId}`);
    }
  }

  /**
   * Core FIFO Queue Processor with Multi-Printer capability matching and load balancing.
   */
  public processQueue(assignments: Record<string, PrinterAssignment>): void {
    if (this.queue.length === 0) {
      return;
    }

    // Iterate through queued jobs in FIFO order
    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];

      // MUST confirm payment before printing
      if (job.paymentStatus !== "confirmed") {
        continue; // Skip this job and check the next one
      }

      // Find an available (idle) compatible printer
      const availablePrinter = this.findIdleCompatiblePrinter(job.hasColor, assignments);

      if (availablePrinter) {
        // Dequeue this job from the FIFO queue
        this.queue.splice(i, 1);
        i--; // Adjust index after splice

        const printerName = availablePrinter.printer_name;

        // Mark printer as busy
        const currentWorker = this.printerWorkers.get(printerName) || {
          isBusy: false,
          jobsCompleted: 0,
        };

        this.printerWorkers.set(printerName, {
          ...currentWorker,
          isBusy: true,
          currentSessionId: job.sessionId,
          currentJobToken: job.tokenCode,
        });

        this.notifyQueueUpdate(assignments);

        console.log(
          `[FifoDispatcher] Dispatching job ${job.tokenCode} to Printer #${availablePrinter.printer_number} (${printerName}).`
        );

        // Execute print asynchronously without blocking the loop so other printers can take other jobs!
        this.executePrintJob(job, availablePrinter, assignments);
      }
    }
  }

  /**
   * Executes a print job on the designated physical printer.
   */
  private async executePrintJob(
    job: QueuedPrintJob,
    printer: PrinterAssignment,
    assignments: Record<string, PrinterAssignment>
  ): Promise<void> {
    const printerName = printer.printer_name;
    this.callbacks.onJobStarted?.(job, printerName);

    try {
      for (let fIdx = 0; fIdx < job.files.length; fIdx++) {
        const file = job.files[fIdx];
        const settings = file.settings;

        this.callbacks.onJobFileProgress?.(
          job.sessionId,
          file.fileName,
          fIdx + 1,
          job.files.length,
          printerName
        );

        // Send to Windows Print Spooler via Electron API
        const printRes = await (window as any).electronAPI.printPdf(file.buffer, job.sessionId, {
          printer: printerName,
          copies: settings.copies || 1,
          orientation: settings.orientation,
          scale: settings.pageFit === "fill" ? "noscale" : "fit",
        });

        if (printRes && !printRes.success) {
          throw new Error(printRes.error || `Hardware spooler error on ${printerName || "Default Printer"}`);
        }
      }

      console.log(
        `[FifoDispatcher] Successfully spooled & shredded Token ${job.tokenCode} on ${printerName || "Default Printer"}!`
      );

      // Clean up failedJobs if this was a retried job that succeeded
      this.failedJobs.delete(job.sessionId);

      // Increment completed count
      const worker = this.printerWorkers.get(printerName) || {
        isBusy: false,
        jobsCompleted: 0,
      };
      this.printerWorkers.set(printerName, {
        isBusy: false,
        currentJobToken: undefined,
        currentSessionId: undefined,
        jobsCompleted: worker.jobsCompleted + 1,
      });

      this.callbacks.onJobCompleted?.(job, printerName || "Default Printer");
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(
        `[FifoDispatcher] Error printing Token ${job.tokenCode} on ${printerName || "Default Printer"}:`,
        errorMsg
      );

      // Retain failed job in memory so shopkeeper can fix the printer and retry
      this.failedJobs.set(job.sessionId, job);

      const worker = this.printerWorkers.get(printerName) || {
        isBusy: false,
        jobsCompleted: 0,
      };
      this.printerWorkers.set(printerName, {
        isBusy: false,
        currentJobToken: undefined,
        currentSessionId: undefined,
        jobsCompleted: worker.jobsCompleted,
      });

      this.callbacks.onJobFailed?.(job, errorMsg, printerName || "Default Printer");
    } finally {
      this.notifyQueueUpdate(assignments);

      // Immediately process the next waiting job in the FIFO queue for this freed printer!
      setTimeout(() => {
        this.processQueue(assignments);
      }, 100);
    }
  }

  /**
   * Finds the best compatible idle printer.
   * If multiple idle printers are compatible, balances load by picking the one with fewest completed jobs.
   */
  private findIdleCompatiblePrinter(
    hasColor: boolean,
    assignments: Record<string, PrinterAssignment>
  ): PrinterAssignment | null {
    const list = Object.values(assignments).filter(
      (a) => a.role !== "disabled" && a.is_active !== false
    );

    // If no configured active assignments exist in the shop yet,
    // automatically provide a default fallback printer so jobs can print immediately!
    if (list.length === 0) {
      const fallbackPrinter: PrinterAssignment = {
        shop_id: this.shopId,
        printer_name: "", // empty string tells Windows spooler / ptp to use system default
        printer_number: 1,
        role: "both",
        is_default: true,
        is_active: true,
      };
      const workerState = this.printerWorkers.get("") || {
        isBusy: false,
        jobsCompleted: 0,
      };
      if (!workerState.isBusy) {
        return fallbackPrinter;
      }
      return null;
    }

    // Filter idle printers
    const idleList = list.filter((p) => {
      const state = this.printerWorkers.get(p.printer_name);
      return !state?.isBusy;
    });

    if (idleList.length === 0) return null;

    // Find compatible idle printers
    const compatibleIdle = idleList.filter((p) => this.isCompatible(p, hasColor));

    if (compatibleIdle.length === 0) return null;

    // Sort by best fit:
    // 1. Dedicated role preferred (B&W -> role 'bw'; Color -> role 'color')
    // 2. Fewest jobs completed (round-robin wear balancing)
    compatibleIdle.sort((a, b) => {
      const scoreA = this.getCompatibilityScore(a, hasColor);
      const scoreB = this.getCompatibilityScore(b, hasColor);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      const countA = this.printerWorkers.get(a.printer_name)?.jobsCompleted || 0;
      const countB = this.printerWorkers.get(b.printer_name)?.jobsCompleted || 0;
      return countA - countB;
    });

    return compatibleIdle[0];
  }

  /**
   * Finds the best compatible printer (even if currently busy) for token labeling and routing.
   */
  private findBestCompatiblePrinter(
    hasColor: boolean,
    assignments: Record<string, PrinterAssignment>
  ): PrinterAssignment | null {
    const list = Object.values(assignments).filter(
      (a) => a.role !== "disabled" && a.is_active !== false
    );

    if (list.length === 0) {
      return {
        shop_id: this.shopId,
        printer_name: "",
        printer_number: 1,
        role: "both",
        is_default: true,
        is_active: true,
      };
    }

    const compatible = list.filter((p) => this.isCompatible(p, hasColor));
    if (compatible.length > 0) {
      compatible.sort((a, b) => {
        const scoreA = this.getCompatibilityScore(a, hasColor);
        const scoreB = this.getCompatibilityScore(b, hasColor);
        return scoreB - scoreA;
      });
      return compatible[0];
    }

    // Fallback: Default active printer or first active
    return list.find((a) => a.is_default) || list[0];
  }

  /**
   * Checks if printer capabilities match job requirements.
   */
  private isCompatible(printer: PrinterAssignment, hasColor: boolean): boolean {
    if (printer.role === "disabled" || printer.is_active === false) {
      return false;
    }
    if (hasColor) {
      return printer.role === "color" || printer.role === "both";
    } else {
      return printer.role === "bw" || printer.role === "both";
    }
  }

  /**
   * Scores compatibility (higher = better fit).
   * Dedicated B&W printer scores higher for B&W jobs to save color toner.
   * Dedicated Color printer scores higher for Color jobs.
   */
  private getCompatibilityScore(printer: PrinterAssignment, hasColor: boolean): number {
    if (hasColor) {
      if (printer.role === "color") return 100;
      if (printer.role === "both") return 50;
      return 0;
    } else {
      if (printer.role === "bw") return 100;
      if (printer.role === "both") return 50;
      return 0;
    }
  }

  private getEstimatedQueuePosition(): number {
    let busyCount = 0;
    for (const w of this.printerWorkers.values()) {
      if (w.isBusy) busyCount++;
    }
    return this.queue.length + (busyCount > 0 ? 1 : 0) + 1;
  }

  private notifyQueueUpdate(assignments: Record<string, PrinterAssignment>): void {
    const list = Object.values(assignments).filter(
      (a) => a.role !== "disabled" && a.is_active !== false
    );

    const workers: PrinterWorkerStatus[] = list.map((p) => {
      const state = this.printerWorkers.get(p.printer_name);
      return {
        printerName: p.printer_name,
        printerNumber: p.printer_number,
        role: p.role,
        isBusy: Boolean(state?.isBusy),
        currentJobToken: state?.currentJobToken,
        currentSessionId: state?.currentSessionId,
        jobsCompleted: state?.jobsCompleted || 0,
      };
    });

    this.callbacks.onQueueUpdated?.([...this.queue], workers);
  }

  public getQueue(): QueuedPrintJob[] {
    return [...this.queue];
  }

  public getPrinterWorkerStatuses(
    assignments: Record<string, PrinterAssignment>
  ): PrinterWorkerStatus[] {
    const list = Object.values(assignments).filter(
      (a) => a.role !== "disabled" && a.is_active !== false
    );

    return list.map((p) => {
      const state = this.printerWorkers.get(p.printer_name);
      return {
        printerName: p.printer_name,
        printerNumber: p.printer_number,
        role: p.role,
        isBusy: Boolean(state?.isBusy),
        currentJobToken: state?.currentJobToken,
        currentSessionId: state?.currentSessionId,
        jobsCompleted: state?.jobsCompleted || 0,
      };
    });
  }

  /**
   * Re-enqueues a failed job to the front of the queue to retry printing.
   */
  public retryJob(sessionId: string, assignments: Record<string, PrinterAssignment>): boolean {
    const job = this.failedJobs.get(sessionId);
    if (!job) {
      console.warn(`[FifoDispatcher] Cannot retry: job ${sessionId} not found in failed jobs`);
      return false;
    }

    this.failedJobs.delete(sessionId);
    console.log(`[FifoDispatcher] Retrying failed job for Token ${job.tokenCode}...`);
    // Prepend to front of queue so retried job prints next (FIFO priority)
    this.queue.unshift(job);
    this.notifyQueueUpdate(assignments);
    this.processQueue(assignments);
    return true;
  }

  /**
   * Dismisses a failed job from the retry cache.
   */
  public dismissFailedJob(sessionId: string): void {
    this.failedJobs.delete(sessionId);
  }

  /**
   * Gets all currently failed jobs awaiting retry or dismissal.
   */
  public getFailedJobs(): QueuedPrintJob[] {
    return Array.from(this.failedJobs.values());
  }
}
