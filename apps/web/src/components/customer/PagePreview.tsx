"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import type {
  UploadedDocument,
  ShopRateCard,
  FinishingService,
} from "@printap/shared";
import AdSlot from "@/components/ads/AdSlot";

interface PagePreviewProps {
  documents: UploadedDocument[];
  rateCard: ShopRateCard;
  finishingServices: FinishingService[];
  onBack: () => void;
  onContinue: () => void;
}

/**
 * Dynamically loads Mozilla PDF.js from the local static assets.
 * Guarantees zero plugin dependencies and 100% universal browser rendering.
 */
function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Window undefined"));
  if ((window as any).pdfjsLib) {
    return Promise.resolve((window as any).pdfjsLib);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="/pdf.min.js"]');
    if (existing) {
      existing.addEventListener("load", () => {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
          resolve(pdfjs);
        } else {
          reject(new Error("pdfjsLib not defined after script load"));
        }
      });
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src = "/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
        resolve(pdfjs);
      } else {
        reject(new Error("pdfjsLib not defined"));
      }
    };
    script.onerror = (e) => reject(new Error("Failed to load PDF.js: " + String(e)));
    document.head.appendChild(script);
  });
}

export default function PagePreview({
  documents,
  rateCard,
  finishingServices,
  onBack,
  onContinue,
}: PagePreviewProps) {
  // Separate non-image documents (e.g. PDFs) and image documents
  const pdfDocs = useMemo(
    () => documents.filter((d) => d.type !== "image"),
    [documents]
  );
  const imageDocs = useMemo(
    () => documents.filter((d) => d.type === "image"),
    [documents]
  );

  // Define tabs: each PDF document + (if any images exist) one unified Images Batch tab
  interface PreviewTab {
    id: string;
    type: "pdf" | "image_batch";
    title: string;
    doc?: UploadedDocument;
  }

  const tabs = useMemo<PreviewTab[]>(() => {
    const list: PreviewTab[] = [];
    pdfDocs.forEach((d) => {
      list.push({
        id: d.id,
        type: "pdf",
        title: d.file.name,
        doc: d,
      });
    });
    if (imageDocs.length > 0) {
      list.push({
        id: "images-batch",
        type: "image_batch",
        title: `Photos & Images (${imageDocs.length})`,
      });
    }
    return list;
  }, [pdfDocs, imageDocs]);

  const [activeTabId, setActiveTabId] = useState<string>(
    tabs[0]?.id || ""
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSheet, setCurrentSheet] = useState(1);

  // Sync tab if tabs change
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTabId) && tabs.length > 0) {
      setActiveTabId(tabs[0].id);
      setCurrentPage(1);
      setCurrentSheet(1);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  if (!activeTab) return null;

  const isImageBatch = activeTab.type === "image_batch";

  // Common settings for the active view
  const activeSettings = isImageBatch
    ? imageDocs[0]?.settings
    : activeTab.doc?.settings;

  const isLandscape = activeSettings?.orientation === "landscape";
  const isBw = activeSettings?.colorMode === "bw";
  const gridLayout = activeSettings?.pagesPerSheet || 1;

  // Image batch pagination calculation
  const totalImageSheets = useMemo(() => {
    if (!isImageBatch || imageDocs.length === 0) return 1;
    return Math.ceil(imageDocs.length / gridLayout);
  }, [isImageBatch, imageDocs.length, gridLayout]);

  const currentSheetPhotos = useMemo(() => {
    if (!isImageBatch) return [];
    const startIndex = (currentSheet - 1) * gridLayout;
    return imageDocs.slice(startIndex, startIndex + gridLayout);
  }, [isImageBatch, imageDocs, currentSheet, gridLayout]);

  // Document types detection
  const isTextDoc = Boolean(
    !isImageBatch &&
    activeTab.doc?.file &&
    (activeTab.doc.type === "text" ||
      activeTab.doc.file.type.startsWith("text/") ||
      /\.(txt|csv|md|log|json|rtf)$/i.test(activeTab.doc.file.name))
  );

  const isImageDoc = Boolean(
    !isImageBatch &&
    activeTab.doc &&
    (activeTab.doc.type === "image" ||
      activeTab.doc.file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|bmp|svg|tiff?)$/i.test(activeTab.doc.file.name))
  );

  const isOfficeDoc = Boolean(
    !isImageBatch &&
    activeTab.doc &&
    (activeTab.doc.type === "doc" ||
      activeTab.doc.type === "sheet" ||
      activeTab.doc.type === "presentation" ||
      activeTab.doc.type === "other" ||
      /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(activeTab.doc.file.name))
  );

  const isPdfDoc = Boolean(
    !isImageBatch &&
    !isTextDoc &&
    !isImageDoc &&
    !isOfficeDoc &&
    activeTab.doc?.file &&
    (activeTab.doc.type === "pdf" ||
      activeTab.doc.file.type === "application/pdf" ||
      /\.pdf$/i.test(activeTab.doc.file.name))
  );

  const isSingleOrOneInOne = Boolean(
    (isImageBatch && (gridLayout === 1 || imageDocs.length === 1)) ||
    (!isImageBatch && (activeSettings?.pagesPerSheet === 1 || isImageDoc))
  );

  // Text content reader for text files
  const [textContent, setTextContent] = useState<string | null>(null);
  useEffect(() => {
    if (isTextDoc && activeTab.doc?.file) {
      activeTab.doc.file
        .text()
        .then((txt) => setTextContent(txt.slice(0, 5000)))
        .catch(() => setTextContent(null));
    } else {
      setTextContent(null);
    }
  }, [isTextDoc, activeTab.doc?.file]);

  // Object URL for image documents fallback
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImageBatch && activeTab.doc?.file) {
      const url = URL.createObjectURL(activeTab.doc.file);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [isImageBatch, activeTab.doc?.file]);

  // ─── PDF.js Direct Canvas Rendering ───
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(1);
  const [isPdfRendering, setIsPdfRendering] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // 1. Load PDF document into memory via PDF.js
  useEffect(() => {
    if (!isPdfDoc || !activeTab.doc?.file) {
      setPdfDocProxy(null);
      return;
    }

    let isSubscribed = true;
    setIsPdfRendering(true);
    setPdfError(null);

    const file = activeTab.doc.file;

    loadPdfJs()
      .then(async (pdfjs) => {
        if (!isSubscribed) return;
        const arrayBuffer = await file.arrayBuffer();
        if (!isSubscribed) return;

        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isSubscribed) return;

        setPdfDocProxy(doc);
        setPdfTotalPages(doc.numPages || 1);
        setIsPdfRendering(false);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.error("[PagePreview] PDF parse error:", err);
        setPdfError("Unable to render PDF preview.");
        setIsPdfRendering(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isPdfDoc, activeTab.doc?.file]);

  // 2. Render current page to <canvas>
  useEffect(() => {
    if (!isPdfDoc || !pdfDocProxy || !canvasRef.current) return;

    let isSubscribed = true;
    let activeRenderTask: any = null;
    setIsPdfRendering(true);

    const safePage = Math.min(Math.max(1, currentPage), pdfTotalPages);

    pdfDocProxy
      .getPage(safePage)
      .then((page: any) => {
        if (!isSubscribed || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Render at high resolution to match device pixel ratio
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = isLandscape ? 476 : 336;
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
        const baseScale = targetWidth / unscaledViewport.width;
        const scale = Math.max(1.2, baseScale * Math.min(dpr, 2.5));
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        activeRenderTask = page.render({
          canvasContext: ctx,
          viewport: viewport,
        });

        return activeRenderTask.promise;
      })
      .then(() => {
        if (isSubscribed) setIsPdfRendering(false);
      })
      .catch((err: any) => {
        if (isSubscribed && err?.name !== "RenderingCancelledException") {
          console.warn("[PagePreview] Page render error:", err);
          setIsPdfRendering(false);
        }
      });

    return () => {
      isSubscribed = false;
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {}
      }
    };
  }, [isPdfDoc, pdfDocProxy, currentPage, pdfTotalPages, isLandscape]);

  // Release canvas bitmap memory on unmount
  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    };
  }, []);

  // Effective page count for pagination controls
  const totalDocPages = isPdfDoc
    ? pdfTotalPages
    : activeTab.doc?.pageCount || 1;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ── Long & Slim Banner Ad Container ── */}
      <AdSlot variant="slim-banner" className="mb-2" />

      {/* Multi-Document / Images Switcher Tabs */}
      {tabs.length > 1 && (
        <div className="glass rounded-2xl p-3 glow-sm mb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTabId(tab.id);
                  setCurrentPage(1);
                  setCurrentSheet(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTabId === tab.id
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"
                }`}
              >
                <span>
                  {tab.type === "image_batch"
                    ? "🖼️"
                    : tab.doc?.type === "doc"
                    ? "📝"
                    : tab.doc?.type === "sheet"
                    ? "📊"
                    : tab.doc?.type === "presentation"
                    ? "📽️"
                    : tab.doc?.type === "text"
                    ? "📄"
                    : "📄"}
                </span>
                <span className="truncate max-w-[160px]">{tab.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Authentic Paper Canvas Viewport ── */}
      <div className="glass rounded-2xl p-5 sm:p-6 glow-sm text-center">
        {/* Active badges bar */}
        <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isBw
                ? "bg-zinc-100 text-zinc-800 border-zinc-300"
                : "bg-gradient-to-r from-indigo-50 to-pink-50 text-indigo-700 border-indigo-200"
            }`}
          >
            {isBw ? "⚫ Monochrome (B&W)" : "🎨 Full Color"}
          </span>

          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
            {isLandscape ? "▭ Landscape" : "▯ Portrait"}
          </span>

          {activeSettings?.colorMode !== "color" && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
              {activeSettings?.duplex === "double" ? "2-Sided (Duplex)" : "1-Sided"}
            </span>
          )}

          {isSingleOrOneInOne && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {activeSettings?.pageFit === "fill" ? "📐 Fill Page (Full Bleed)" : "📏 Fit to Page"}
            </span>
          )}

          {isImageBatch && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {gridLayout}-in-1 Photo Grid
            </span>
          )}
        </div>

        {/* Paper Sheet Viewport (Strict A4 Aspect Ratio: 1 : 1.414 or 1.414 : 1) */}
        <div className="w-full flex items-center justify-center py-6 bg-zinc-200/50 rounded-2xl border border-zinc-300/60 overflow-hidden shadow-inner">
          <div
            className={`relative bg-white transition-all duration-300 overflow-hidden flex flex-col ${
              isLandscape
                ? "w-[336px] sm:w-[476px] h-[238px] sm:h-[336px]"
                : "w-[238px] sm:w-[336px] h-[336px] sm:h-[476px]"
            }`}
            style={{
              boxShadow:
                "0 20px 35px -10px rgba(0, 0, 0, 0.25), 0 5px 12px -2px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.3)",
              filter: isBw
                ? "grayscale(100%) contrast(1.15) brightness(0.97)"
                : "none",
            }}
          >
            {/* Authentic Printable Margins or Full-Bleed Edge-to-Edge */}
            <div
              className={`w-full h-full flex items-center justify-center overflow-hidden ${
                isSingleOrOneInOne && activeSettings?.pageFit === "fill"
                  ? "p-0"
                  : "p-2.5 sm:p-4"
              }`}
            >
              {/* ──────────────────────────────────────────────────
                  A. IMAGE BATCH: Render actual photos in grid
                  (1in1, 2in1, 4in1, 6in1, 9in1)
              ────────────────────────────────────────────────── */}
              {isImageBatch && (
                <div className="w-full h-full flex items-center justify-center">
                  {/* 1-in-1: Single photo centered on the sheet */}
                  {gridLayout === 1 && currentSheetPhotos[0] && (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                      <img
                        src={currentSheetPhotos[0].thumbnailUrl}
                        alt="Photo Preview"
                        className={
                          activeSettings?.pageFit === "fill"
                            ? "w-full h-full object-cover"
                            : "max-w-full max-h-full object-contain"
                        }
                      />
                    </div>
                  )}

                  {/* 2-in-1: 2 photos on paper */}
                  {gridLayout === 2 && (
                    <div
                      className={`w-full h-full grid gap-2 ${
                        isLandscape ? "grid-cols-2" : "grid-rows-2"
                      }`}
                    >
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 4-in-1: 2x2 grid */}
                  {gridLayout === 4 && (
                    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2">
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 6-in-1: 2x3 or 3x2 grid */}
                  {gridLayout === 6 && (
                    <div
                      className={`w-full h-full grid gap-1.5 ${
                        isLandscape
                          ? "grid-cols-3 grid-rows-2"
                          : "grid-cols-2 grid-rows-3"
                      }`}
                    >
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 9-in-1: 3x3 grid */}
                  {gridLayout === 9 && (
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-1">
                      {currentSheetPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="w-full h-full flex items-center justify-center overflow-hidden"
                        >
                          <img
                            src={photo.thumbnailUrl}
                            alt="Photo Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────────────────────────────────────────
                  B. UNIVERSAL DOCUMENT PREVIEW: Direct Canvas / Text / Image
                  (Zero iframes, zero plugins, 100% viewable)
              ────────────────────────────────────────────────── */}
              {!isImageBatch && activeTab.doc && (
                <div className="w-full h-full flex items-center justify-center overflow-hidden bg-white relative">
                  {/* Case 1: Image Document */}
                  {isImageDoc ? (
                    <img
                      src={activeTab.doc.thumbnailUrl || blobUrl || undefined}
                      alt={activeTab.doc.file.name}
                      className={
                        activeSettings?.pageFit === "fill"
                          ? "w-full h-full object-cover"
                          : "max-w-full max-h-full object-contain"
                      }
                    />
                  ) : isTextDoc && textContent !== null ? (
                    /* Case 2: Text / CSV / Markdown Document */
                    <div className="w-full h-full p-3.5 text-left overflow-auto font-mono text-[10px] sm:text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap select-text">
                      {textContent}
                    </div>
                  ) : isOfficeDoc ? (
                    /* Case 3: Office Document (Word, Excel, PowerPoint, OpenDoc) */
                    <div className="w-full h-full p-6 flex flex-col justify-between items-center text-center bg-gradient-to-b from-white to-zinc-50 select-none">
                      {/* Top Header Badge */}
                      <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-100">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                            activeTab.doc.type === "doc"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : activeTab.doc.type === "sheet"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : activeTab.doc.type === "presentation"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {activeTab.doc.type === "doc" && "📘 Word Document"}
                          {activeTab.doc.type === "sheet" && "📗 Excel Spreadsheet"}
                          {activeTab.doc.type === "presentation" && "📙 PowerPoint Presentation"}
                          {activeTab.doc.type === "other" && "📄 Document File"}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {(activeTab.doc.file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>

                      {/* Main Icon & Title */}
                      <div className="my-auto flex flex-col items-center max-w-sm px-4">
                        <div
                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-3 shadow-sm ${
                            activeTab.doc.type === "doc"
                              ? "bg-blue-50 text-blue-600 ring-4 ring-blue-100/60"
                              : activeTab.doc.type === "sheet"
                              ? "bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100/60"
                              : activeTab.doc.type === "presentation"
                              ? "bg-amber-50 text-amber-600 ring-4 ring-amber-100/60"
                              : "bg-purple-50 text-purple-600 ring-4 ring-purple-100/60"
                          }`}
                        >
                          {activeTab.doc.type === "doc" && (
                            <svg className="w-9 h-9 sm:w-11 sm:h-11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                          {activeTab.doc.type === "sheet" && (
                            <svg className="w-9 h-9 sm:w-11 sm:h-11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          {activeTab.doc.type === "presentation" && (
                            <svg className="w-9 h-9 sm:w-11 sm:h-11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                          )}
                          {activeTab.doc.type === "other" && (
                            <svg className="w-9 h-9 sm:w-11 sm:h-11" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-zinc-800 line-clamp-2 break-all mb-1">
                          {activeTab.doc.file.name}
                        </h4>

                        <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                            {activeTab.doc.pageCount}{" "}
                            {activeTab.doc.type === "presentation"
                              ? activeTab.doc.pageCount === 1 ? "Slide" : "Slides"
                              : activeTab.doc.type === "sheet"
                              ? activeTab.doc.pageCount === 1 ? "Sheet" : "Sheets"
                              : activeTab.doc.pageCount === 1 ? "Page" : "Pages"}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                            {activeSettings?.colorMode === "bw" ? "B&W Print" : "Color Print"}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Spooling Verification Footnote */}
                      <div className="w-full pt-3 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500">
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Document verified for high-resolution spooling</span>
                      </div>
                    </div>
                  ) : isPdfDoc ? (
                    /* Case 3: PDF Document Rendered Directly to Canvas via Mozilla PDF.js */
                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-white">
                      {isPdfRendering && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-2xs z-10 gap-1.5">
                          <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin" />
                          <span className="text-[10px] font-bold text-zinc-600">
                            Rendering Page {currentPage}...
                          </span>
                        </div>
                      )}

                      <canvas
                        ref={canvasRef}
                        className={
                          isSingleOrOneInOne && activeSettings?.pageFit === "fill"
                            ? "w-full h-full object-cover"
                            : "max-w-full max-h-full object-contain"
                        }
                        style={{ display: pdfDocProxy ? "block" : "none" }}
                      />

                      {pdfError && (
                        <div className="p-4 text-center text-xs text-zinc-500">
                          <span className="block text-red-500 font-semibold mb-1">Preview Notice</span>
                          {pdfError}
                        </div>
                      )}

                      {!pdfDocProxy && !pdfError && !isPdfRendering && (
                        <div className="flex flex-col items-center justify-center text-zinc-400 gap-1.5 p-4 text-center">
                          <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin" />
                          <span className="text-xs font-medium">Loading document...</span>
                        </div>
                      )}
                    </div>
                  ) : activeTab.doc.thumbnailUrl ? (
                    <img
                      src={activeTab.doc.thumbnailUrl}
                      alt="Document Page"
                      className={
                        isSingleOrOneInOne && activeSettings?.pageFit === "fill"
                          ? "w-full h-full object-cover"
                          : "max-w-full max-h-full object-contain"
                      }
                    />
                  ) : (
                    <div className="w-full h-full border border-zinc-200 flex flex-col items-center justify-center text-zinc-400 text-xs p-4 text-center">
                      <span>📄</span>
                      <span className="mt-1 font-medium">{activeTab.doc.file.name}</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5">Page {currentPage}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sheet / Page Switcher Navigation (Outside the Paper Area) ── */}
        {isImageBatch && totalImageSheets > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setCurrentSheet((s) => Math.max(1, s - 1))}
              disabled={currentSheet <= 1}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              ← Prev Sheet
            </button>

            <span className="text-xs font-mono font-bold text-zinc-800">
              Sheet {currentSheet} of {totalImageSheets}
            </span>

            <button
              type="button"
              onClick={() => setCurrentSheet((s) => Math.min(totalImageSheets, s + 1))}
              disabled={currentSheet >= totalImageSheets}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next Sheet →
            </button>
          </div>
        )}

        {!isImageBatch && totalDocPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              ← Prev Page
            </button>

            <span className="text-xs font-mono font-bold text-zinc-800">
              Page {currentPage} of {totalDocPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalDocPages, p + 1))
              }
              disabled={currentPage >= totalDocPages}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next Page →
            </button>
          </div>
        )}
      </div>

      {/* ── Order Specs Summary Card ── */}
      <div className="glass rounded-2xl p-5 glow-sm space-y-3">
        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
          Job Specifications
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Document Selection</span>
            <span className="font-semibold text-zinc-900 truncate max-w-[220px]">
              {isImageBatch ? `Photos & Images (${imageDocs.length} photos)` : activeTab.title}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Grid / Layout</span>
            <span className="font-semibold text-zinc-900">
              {isImageBatch
                ? `${gridLayout}-in-1 Photo Grid`
                : `${activeSettings?.pagesPerSheet || 1}-in-1 Page Layout`}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Sets / Copies</span>
            <span className="font-mono font-bold text-zinc-900">
              {activeSettings?.copies || 1}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-zinc-100">
            <span className="text-zinc-500">Color Reproduction</span>
            <span className="font-semibold text-zinc-900 capitalize">
              {isBw ? "Black & White (Monochrome)" : "High-Res Full Color"}
            </span>
          </div>

          {isSingleOrOneInOne && (
            <div
              className={`flex justify-between py-1.5 ${
                activeSettings?.colorMode !== "color" ? "border-b border-zinc-100" : ""
              }`}
            >
              <span className="text-zinc-500">Page Fit / Margins</span>
              <span className="font-semibold text-zinc-900">
                {activeSettings?.pageFit === "fill"
                  ? "Fill Page (Borderless / Edge-to-Edge)"
                  : "Fit to Page (Printable Margins)"}
              </span>
            </div>
          )}

          {activeSettings?.colorMode !== "color" && (
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-500">Duplex / Sides</span>
              <span className="font-semibold text-zinc-900 capitalize">
                {activeSettings?.duplex === "double" ? "2-Sided (Back to Back)" : "Single Sided"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
