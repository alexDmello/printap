"use client";

import React, { useState, useCallback, useRef } from "react";
import type { UploadedDocument, DocumentType, PrintSettings } from "@printap/shared";
import { DEFAULT_PRINT_SETTINGS } from "@printap/shared";
import AdSlot from "@/components/ads/AdSlot";

const ACCEPTED_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.jpg,.jpeg,.png,.webp,.gif,.bmp,.svg,.tiff,image/*,text/*,application/*";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function detectDocumentType(file: File): DocumentType {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  // 1. PDF
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }

  // 2. Images
  if (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|svg|tiff?|ico|heic|avif)$/i.test(name)
  ) {
    return "image";
  }

  // 3. Word / Documents
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    mime === "application/vnd.oasis.opendocument.text" ||
    mime === "application/rtf" ||
    /\.(docx?|rtf|odt|pages|wps)$/i.test(name)
  ) {
    return "doc";
  }

  // 4. Spreadsheets
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet" ||
    mime === "text/csv" ||
    /\.(xlsx?|csv|ods|numbers|tsv)$/i.test(name)
  ) {
    return "sheet";
  }

  // 5. Presentations
  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.oasis.opendocument.presentation" ||
    /\.(pptx?|odp|key)$/i.test(name)
  ) {
    return "presentation";
  }

  // 6. Text / Code / Notes
  if (
    mime.startsWith("text/") ||
    /\.(txt|md|log|json|xml|html?|yaml|yml)$/i.test(name)
  ) {
    return "text";
  }

  return "other";
}

function getFileIcon(type: DocumentType): React.ReactNode {
  switch (type) {
    case "pdf":
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    case "doc":
      return (
        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          <path fill="#fff" d="M7 8h6v1.5H7V8zm0 3h6v1.5H7V11zm0 3h4v1.5H7V14z" />
        </svg>
      );
    case "sheet":
      return (
        <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          <path fill="#fff" d="M6 8h3v2H6V8zm5 0h3v2h-3V8zm-5 4h3v2H6v-2zm5 0h3v2h-3v-2z" />
        </svg>
      );
    case "presentation":
      return (
        <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2v6h10V6H5zm3 9h4v2H8v-2z" clipRule="evenodd" />
        </svg>
      );
    case "image":
      return (
        <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    case "text":
      return (
        <svg className="w-5 h-5 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          <path stroke="#fff" strokeLinecap="round" strokeWidth="1.5" d="M7 8h6M7 11h6M7 14h4" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
  }
}

/**
 * Parses PDF page count from the file's binary header.
 */
async function parsePdfPageCount(file: File): Promise<number> {
  try {
    const text = await file.text();
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    return matches && matches.length > 0 ? matches.length : 1;
  } catch {
    return 1;
  }
}

/**
 * Parses Word (.docx) page count from internal XML metadata or size.
 */
async function parseDocxPageCount(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const text = decoder.decode(buffer);
    const match = text.match(/<Pages>(\d+)<\/Pages>/);
    if (match && match[1]) {
      const p = parseInt(match[1], 10);
      if (p > 0) return p;
    }
    return Math.max(1, Math.ceil(file.size / (35 * 1024)));
  } catch {
    return 1;
  }
}

/**
 * Parses PowerPoint (.pptx) slide count from internal XML metadata.
 */
async function parsePptxSlideCount(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const text = decoder.decode(buffer);
    const match = text.match(/<Slides>(\d+)<\/Slides>/);
    if (match && match[1]) {
      const p = parseInt(match[1], 10);
      if (p > 0) return p;
    }
    const slideMatches = text.match(/ppt\/slides\/slide\d+\.xml/g);
    if (slideMatches && slideMatches.length > 0) {
      return new Set(slideMatches).size;
    }
    return Math.max(1, Math.ceil(file.size / (150 * 1024)));
  } catch {
    return 1;
  }
}

/**
 * Parses text file page count based on ~55 lines per A4 page.
 */
async function parseTextPageCount(file: File): Promise<number> {
  try {
    const text = await file.text();
    const lines = text.split("\n").length;
    return Math.max(1, Math.ceil(lines / 55));
  } catch {
    return 1;
  }
}

/**
 * Parses spreadsheet sheet count.
 */
async function parseSheetCount(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const text = decoder.decode(buffer);
    const sheetMatches = text.match(/<sheet\s+name=/g);
    if (sheetMatches && sheetMatches.length > 0) {
      return sheetMatches.length;
    }
    return 1;
  } catch {
    return 1;
  }
}

interface FileUploadProps {
  documents: UploadedDocument[];
  onDocumentsChange: (docs: UploadedDocument[]) => void;
  onContinue: () => void;
  errorMsg: string;
  onError: (msg: string) => void;
}

export default function FileUpload({
  documents,
  onDocumentsChange,
  onContinue,
  errorMsg,
  onError,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const newDocs: UploadedDocument[] = [];
      let hasError = false;

      setIsProcessing(true);

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          onError(`"${file.name}" exceeds the 50 MB limit`);
          hasError = true;
          continue;
        }

        const docType = detectDocumentType(file);

        let pageCount = 1;
        if (docType === "pdf") {
          pageCount = await parsePdfPageCount(file);
        } else if (docType === "doc") {
          pageCount = await parseDocxPageCount(file);
        } else if (docType === "presentation") {
          pageCount = await parsePptxSlideCount(file);
        } else if (docType === "sheet") {
          pageCount = await parseSheetCount(file);
        } else if (docType === "text") {
          pageCount = await parseTextPageCount(file);
        } else {
          pageCount = 1;
        }

        // Generate thumbnail for images
        let thumbnailUrl: string | undefined;
        if (docType === "image") {
          thumbnailUrl = URL.createObjectURL(file);
        }

        newDocs.push({
          id: crypto.randomUUID(),
          file,
          type: docType,
          pageCount,
          thumbnailUrl,
          settings: { ...DEFAULT_PRINT_SETTINGS },
        });
      }

      if (newDocs.length > 0) {
        onDocumentsChange([...documents, ...newDocs]);
        if (!hasError) onError("");
      }
      setIsProcessing(false);
    },
    [documents, onDocumentsChange, onError]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) processFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) processFiles(files);
    },
    [processFiles]
  );

  const removeDocument = useCallback(
    (id: string) => {
      onDocumentsChange(documents.filter((d) => d.id !== id));
    },
    [documents, onDocumentsChange]
  );

  return (
    <div className="animate-fade-in-up space-y-2.5">
      {/* ─── 1. Top Borderless Rectangular / Video-Capable Ad Container (Original Size) ─── */}
      <AdSlot variant="rectangle" className="mb-1.5" />

      {/* ─── 2. Compact Upload Container Below Ad ─── */}
      <div className="glass rounded-2xl p-3.5 sm:p-4 glow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Upload your documents</h2>
            <p className="text-[11px] text-[--color-muted]">
              PDFs, Word, Excel, images · All formats supported
            </p>
          </div>
          {documents.length > 0 && (
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
              {documents.length} {documents.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>

        {/* Drop zone */}
        <label
          htmlFor="multi-file-upload"
          className={`drop-zone flex flex-col items-center justify-center w-full rounded-xl cursor-pointer transition-all ${
            documents.length > 0 ? "h-20" : "h-28"
          } ${
            isDragging
              ? "border-[--color-accent] bg-[--color-accent]/5 scale-[1.01]"
              : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[--color-accent] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[--color-muted]">Processing...</span>
            </div>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-[--color-accent]/10 flex items-center justify-center mb-1 transition-transform hover:scale-105">
                <svg
                  className="w-4 h-4 text-[--color-accent-light]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 16V4m0 0L8 8m4-4l4 4"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"
                  />
                </svg>
              </div>
              <span className="text-xs text-[--color-foreground]/80 font-bold">
                {documents.length > 0 ? "+ Add more files" : "Tap to choose files"}
              </span>
              <span className="text-[10px] text-[--color-muted]">
                or drag and drop here
              </span>
            </>
          )}
          <input
            id="multi-file-upload"
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>

        {/* Error */}
        {errorMsg && (
          <div className="mt-2 flex items-center gap-2 text-[--color-danger] text-xs">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Document list (compact) */}
      {documents.length > 0 && (
        <div className="glass rounded-xl p-3 glow-sm space-y-1.5 max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-zinc-900">
              Selected Documents ({documents.length})
            </span>
            <span className="text-[10px] text-[--color-muted]">
              {documents.reduce((acc, d) => acc + d.pageCount, 0)} total pages
            </span>
          </div>

          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2.5 p-2 rounded-lg bg-[--color-surface-light]/50 group transition-all hover:bg-[--color-surface-light]"
            >
              <div className="w-7 h-7 rounded-md bg-[--color-surface] flex items-center justify-center flex-shrink-0">
                {doc.thumbnailUrl ? (
                  <img
                    src={doc.thumbnailUrl}
                    alt=""
                    className="w-7 h-7 rounded-md object-cover"
                  />
                ) : (
                  getFileIcon(doc.type)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-zinc-900">{doc.file.name}</p>
                <p className="text-[10px] text-[--color-muted]">
                  {formatBytes(doc.file.size)} · {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeDocument(doc.id)}
                className="text-zinc-400 hover:text-red-600 transition p-1.5 rounded-md hover:bg-red-50 flex-shrink-0 cursor-pointer"
                aria-label={`Remove ${doc.file.name}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Zero Cloud Storage Trust Line ─── */}
      <div className="pt-0.5 text-center text-[10px] text-zinc-500">
        <div className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Zero cloud storage · Direct P2P transfer to printer</span>
        </div>
      </div>
    </div>
  );
}
