"use client";

import React from "react";
import type { TransferProgress as TransferProgressType } from "@/lib/customer-signaling";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TransferViewProps {
  progress: TransferProgressType;
  fileCount: number;
}

export default function TransferView({ progress, fileCount }: TransferViewProps) {
  const isMulti = (progress.totalFiles ?? fileCount) > 1;

  return (
    <div className="animate-fade-in-up text-center">
      <div className="glass rounded-2xl p-8 glow-sm animate-pulse-glow">
        {/* Multi-file badge */}
        {isMulti && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300 mb-4">
            <span>📦</span>
            <span>
              Batch Transfer: {progress.currentFileIndex ?? 1} /{" "}
              {progress.totalFiles ?? fileCount} Files
            </span>
          </div>
        )}

        {/* Circular progress */}
        <div className="relative w-28 h-28 mx-auto mb-6">
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              strokeWidth="6"
              fill="none"
              className="circular-progress-track"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="url(#transferProgressGrad)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${
                2 * Math.PI * 42 * (1 - (progress.percent || 0) / 100)
              }`}
              className="circular-progress-fill"
            />
            <defs>
              <linearGradient
                id="transferProgressGrad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">
              {progress.percent}
            </span>
            <span className="text-[10px] text-[--color-muted] -mt-0.5">%</span>
          </div>
        </div>

        <h2 className="text-base font-semibold mb-1">
          {progress.status === "connecting" && "Connecting to counter..."}
          {progress.status === "connected" && "Connected! Starting stream..."}
          {progress.status === "sending" &&
            (isMulti
              ? `Sending file ${progress.currentFileIndex ?? 1} of ${
                  progress.totalFiles ?? fileCount
                }`
              : "Sending document...")}
          {progress.status === "complete" && "Transfer complete!"}
        </h2>

        {progress.currentFileName && progress.status === "sending" && (
          <p className="text-xs font-mono text-indigo-300 truncate max-w-[240px] mx-auto mb-1">
            {progress.currentFileName}
          </p>
        )}

        <p className="text-xs text-[--color-muted]">
          {formatBytes(progress.bytesSent)} of{" "}
          {formatBytes(progress.totalBytes)}
        </p>

        {/* Shimmer bar */}
        <div className="mt-5 h-1.5 rounded-full bg-[--color-border] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-[--color-muted] mt-4">
        ⚡ Encrypted peer-to-peer transfer with shopkeeper terminal
      </p>
    </div>
  );
}
