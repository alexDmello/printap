"use client";

import React, { useState, useCallback, useRef } from "react";
import type { UploadedDocument, DocumentType, PrintSettings } from "@printap/shared";
import { DEFAULT_PRINT_SETTINGS } from "@printap/shared";

const ACCEPTED_TYPES: Record<string, DocumentType> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: DocumentType): React.ReactNode {
  if (type === "pdf") {
    return (
      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Parses PDF page count from the file's binary header.
 * Uses a lightweight regex approach on the first/last chunks.
 */
async function parsePdfPageCount(file: File): Promise<number> {
  try {
    const text = await file.text();
    // Match /Type /Page (not /Pages) entries
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 1;
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
        const docType = ACCEPTED_TYPES[file.type];
        if (!docType) {
          onError(`"${file.name}" is not a supported file type (PDF, JPG, PNG, WEBP)`);
          hasError = true;
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          onError(`"${file.name}" exceeds the 50 MB limit`);
          hasError = true;
          continue;
        }

        let pageCount = 1;
        if (docType === "pdf") {
          pageCount = await parsePdfPageCount(file);
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
    <div className="animate-fade-in-up space-y-4">
      <div className="glass rounded-2xl p-6 glow-sm">
        <h2 className="text-base font-semibold mb-1">Upload your documents</h2>
        <p className="text-xs text-[--color-muted] mb-5">
          PDFs & images up to 50 MB each · Multiple files supported
        </p>

        {/* Drop zone */}
        <label
          htmlFor="multi-file-upload"
          className={`drop-zone flex flex-col items-center justify-center w-full rounded-xl cursor-pointer transition-all ${
            documents.length > 0 ? "h-28" : "h-44"
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
              <div className="w-5 h-5 border-2 border-[--color-accent] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[--color-muted]">Processing...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-[--color-accent]/10 flex items-center justify-center mb-2 transition-transform hover:scale-105">
                <svg
                  className="w-6 h-6 text-[--color-accent-light]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 16V4m0 0L8 8m4-4l4 4"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"
                  />
                </svg>
              </div>
              <span className="text-sm text-[--color-foreground]/70 font-medium">
                {documents.length > 0 ? "Add more files" : "Tap to choose files"}
              </span>
              <span className="text-[11px] text-[--color-muted] mt-0.5">
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
          <div className="mt-3 flex items-center gap-2 text-[--color-danger] text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

      {/* Document list */}
      {documents.length > 0 && (
        <div className="glass rounded-2xl p-4 glow-sm space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">
              {documents.length} {documents.length === 1 ? "file" : "files"} selected
            </h3>
            <span className="text-xs text-[--color-muted]">
              {documents.reduce((acc, d) => acc + d.pageCount, 0)} total pages
            </span>
          </div>

          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-[--color-surface-light]/50 group transition-all hover:bg-[--color-surface-light]"
            >
              <div className="w-9 h-9 rounded-lg bg-[--color-surface] flex items-center justify-center flex-shrink-0">
                {doc.thumbnailUrl ? (
                  <img
                    src={doc.thumbnailUrl}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                ) : (
                  getFileIcon(doc.type)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{doc.file.name}</p>
                <p className="text-[11px] text-[--color-muted]">
                  {formatBytes(doc.file.size)}
                  {doc.type === "pdf" && ` · ${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`}
                </p>
              </div>
              <button
                onClick={() => removeDocument(doc.id)}
                className="text-[--color-muted] hover:text-[--color-danger] transition p-1 opacity-0 group-hover:opacity-100"
                aria-label={`Remove ${doc.file.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Continue button */}
      {documents.length > 0 && (
        <button
          onClick={onContinue}
          className="btn-primary w-full py-3.5 rounded-xl font-semibold text-white text-sm tracking-wide"
        >
          Configure Print Settings →
        </button>
      )}

      {/* Privacy badge */}
      <div className="privacy-badge rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium text-emerald-400">Zero cloud storage</p>
          <p className="text-[11px] text-[--color-muted]">
            Files go directly to the printer via encrypted P2P
          </p>
        </div>
      </div>
    </div>
  );
}
