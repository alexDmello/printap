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

const MAX_FAILED_JOBS_CACHE = 5;
const FAILED_JOB_TTL_MS = 15 * 60 * 1000; // 15 minutes max retention for binary buffers

export class FifoPrintDispatcher {
  private queue: QueuedPrintJob[] = [];
  private allocatedTokens: Map<string, TokenAllocation> = new Map();
  private failedJobs: Map<string, { job: QueuedPrintJob; timer: ReturnType<typeof setTimeout> }> =
    new Map();
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

  public syncSequence(highestKnownSequence: number): void {
    this.checkDayRollover();
    if (highestKnownSequence > this.dailySequence) {
      this.dailySequence = highestKnownSequence;
      const storageKey = `printap_local_seq_${this.shopId || "default"}_${this.currentDateStr}`;
      try {
        localStorage.setItem(storageKey, String(this.dailySequence));
      } catch {}
    }
  }

  public syncFromOrders(orders: Array<{ token_code?: string | null }>): void {
    let maxSeq = 0;
    for (const order of orders) {
      if (!order.token_code) continue;
      const clean = order.token_code.replace(/^#/, "");
      if (clean.includes("-")) {
        const parts = clean.split("-");
        const seq = parseInt(parts[parts.length - 1], 10);
        if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
      } else if (/^\d{2,}$/.test(clean)) {
        const seq = parseInt(clean.slice(1), 10);
        if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    const targetSeq = Math.max(maxSeq, orders.length);
    this.syncSequence(targetSeq);
  }

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
    }
  }

  public allocateToken(
    sessionId: string,
    hasColor: boolean,
    assignments: Record<string, PrinterAssignment>
  ): TokenAllocation {
    this.checkDayRollover();

    const existing = this.allocatedTokens.get(sessionId);
    if (existing) {
      return existing;
    }

    this.dailySequence += 1;
    const storageKey = `printap_local_seq_${this.shopId || "default"}_${this.currentDateStr}`;
    try {
      localStorage.setItem(storageKey, String(this.dailySequence));
    } catch {}

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
    return allocation;
  }

  public getAllocatedToken(sessionId: string): TokenAllocation | undefined {
    return this.allocatedTokens.get(sessionId);
  }

  public enqueue(
    job: QueuedPrintJob,
    assignments: Record<string, PrinterAssignment>
  ): void {
    if (this.queue.some((q) => q.sessionId === job.sessionId)) {
      return;
    }

    this.queue.push(job);
    this.notifyQueueUpdate(assignments);
    this.processQueue(assignments);
  }

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

  public cancelJob(
    sessionId: string,
    assignments: Record<string, PrinterAssignment>
  ): void {
    const index = this.queue.findIndex((q) => q.sessionId === sessionId);
    if (index !== -1) {
      const [removed] = this.queue.splice(index, 1);
      removed.files.forEach((f) => {
        (f as { buffer: ArrayBuffer | null }).buffer = new ArrayBuffer(0);
      });
      this.notifyQueueUpdate(assignments);
    }
    this.dismissFailedJob(sessionId);
  }

  public processQueue(assignments: Record<string, PrinterAssignment>): void {
    if (this.queue.length === 0) {
      return;
    }

    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];

      if (job.paymentStatus !== "confirmed") {
        continue;
      }

      const availablePrinter = this.findIdleCompatiblePrinter(
        job.hasColor,
        assignments
      );

      if (availablePrinter) {
        this.queue.splice(i, 1);
        i--;

        const printerName = availablePrinter.printer_name;
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
        this.executePrintJob(job, availablePrinter, assignments);
      }
    }
  }

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

        const printRes = await window.electronAPI.printPdf(
          file.buffer,
          job.sessionId,
          {
            fileId: file.fileId || `f${fIdx + 1}`,
            printer: printerName,
            copies: settings.copies || 1,
            orientation: settings.orientation,
            scale: settings.pageFit === "fill" ? "noscale" : "fit",
          }
        );

        if (printRes && !printRes.success) {
          throw new Error(
            printRes.error ||
              `Hardware spooler error on ${printerName || "Default Printer"}`
          );
        }
      }

      this.dismissFailedJob(job.sessionId);

      job.files.forEach((f) => {
        (f as { buffer: ArrayBuffer | null }).buffer = new ArrayBuffer(0);
      });

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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.storeFailedJob(job);

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

      this.callbacks.onJobFailed?.(
        job,
        errorMsg,
        printerName || "Default Printer"
      );
    } finally {
      this.notifyQueueUpdate(assignments);
      setTimeout(() => {
        this.processQueue(assignments);
      }, 100);
    }
  }

  private storeFailedJob(job: QueuedPrintJob): void {
    this.dismissFailedJob(job.sessionId);

    if (this.failedJobs.size >= MAX_FAILED_JOBS_CACHE) {
      const oldestKey = this.failedJobs.keys().next().value;
      if (oldestKey) {
        this.dismissFailedJob(oldestKey);
      }
    }

    const timer = setTimeout(() => {
      this.dismissFailedJob(job.sessionId);
    }, FAILED_JOB_TTL_MS);

    this.failedJobs.set(job.sessionId, { job, timer });
  }

  private findIdleCompatiblePrinter(
    hasColor: boolean,
    assignments: Record<string, PrinterAssignment>
  ): PrinterAssignment | null {
    const list = Object.values(assignments).filter(
      (a) => a.role !== "disabled" && a.is_active !== false
    );

    if (list.length === 0) {
      const workerState = this.printerWorkers.get("") || {
        isBusy: false,
        jobsCompleted: 0,
      };
      if (!workerState.isBusy) {
        return {
          shop_id: this.shopId,
          printer_name: "",
          printer_number: 1,
          role: "both",
          is_default: true,
          is_active: true,
        };
      }
      return null;
    }

    const idleList = list.filter((p) => {
      const state = this.printerWorkers.get(p.printer_name);
      return !state?.isBusy;
    });

    if (idleList.length === 0) return null;

    const compatibleIdle = idleList.filter((p) =>
      this.isCompatible(p, hasColor)
    );
    if (compatibleIdle.length === 0) return null;

    compatibleIdle.sort((a, b) => {
      const scoreA = this.getCompatibilityScore(a, hasColor);
      const scoreB = this.getCompatibilityScore(b, hasColor);
      if (scoreA !== scoreB) return scoreB - scoreA;
      const countA = this.printerWorkers.get(a.printer_name)?.jobsCompleted || 0;
      const countB = this.printerWorkers.get(b.printer_name)?.jobsCompleted || 0;
      return countA - countB;
    });

    return compatibleIdle[0];
  }

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
      compatible.sort(
        (a, b) =>
          this.getCompatibilityScore(b, hasColor) -
          this.getCompatibilityScore(a, hasColor)
      );
      return compatible[0];
    }

    return list.find((a) => a.is_default) || list[0];
  }

  private isCompatible(printer: PrinterAssignment, hasColor: boolean): boolean {
    if (printer.role === "disabled" || printer.is_active === false) return false;
    return hasColor
      ? printer.role === "color" || printer.role === "both"
      : printer.role === "bw" || printer.role === "both";
  }

  private getCompatibilityScore(
    printer: PrinterAssignment,
    hasColor: boolean
  ): number {
    if (hasColor) {
      return printer.role === "color" ? 100 : printer.role === "both" ? 50 : 0;
    }
    return printer.role === "bw" ? 100 : printer.role === "both" ? 50 : 0;
  }

  private getEstimatedQueuePosition(): number {
    let busyCount = 0;
    for (const w of this.printerWorkers.values()) {
      if (w.isBusy) busyCount++;
    }
    return this.queue.length + (busyCount > 0 ? 1 : 0) + 1;
  }

  private notifyQueueUpdate(
    assignments: Record<string, PrinterAssignment>
  ): void {
    const workers = this.getPrinterWorkerStatuses(assignments);
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

  public retryJob(
    sessionId: string,
    assignments: Record<string, PrinterAssignment>
  ): boolean {
    const entry = this.failedJobs.get(sessionId);
    if (!entry) return false;

    clearTimeout(entry.timer);
    this.failedJobs.delete(sessionId);
    this.queue.unshift(entry.job);
    this.notifyQueueUpdate(assignments);
    this.processQueue(assignments);
    return true;
  }

  public dismissFailedJob(sessionId: string): void {
    const entry = this.failedJobs.get(sessionId);
    if (entry) {
      clearTimeout(entry.timer);
      entry.job.files.forEach((f) => {
        (f as { buffer: ArrayBuffer | null }).buffer = new ArrayBuffer(0);
      });
      this.failedJobs.delete(sessionId);
    }
  }

  public getFailedJobs(): QueuedPrintJob[] {
    return Array.from(this.failedJobs.values()).map((e) => e.job);
  }
}
