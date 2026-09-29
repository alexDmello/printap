"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { QueueToken, JobStatus } from "@printap/shared";

interface LiveQueueTrackerProps {
  token: QueueToken;
  jobStatus: JobStatus;
  onStatusChange: (status: JobStatus) => void;
  onPickupReady: () => void;
}

const STATUS_STEPS: { key: JobStatus; label: string; icon: string }[] = [
  { key: "queued", label: "In Queue", icon: "⏳" },
  { key: "printing", label: "Printing", icon: "🖨️" },
  { key: "ready_for_pickup", label: "Ready!", icon: "✅" },
];

/**
 * Plays a pleasant notification chime using Web Audio API.
 */
function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-tone ascending chime
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    });
  } catch {
    // Web Audio not available
  }
}

export default function LiveQueueTracker({
  token,
  jobStatus,
  onStatusChange,
  onPickupReady,
}: LiveQueueTrackerProps) {
  const [currentPosition, setCurrentPosition] = useState(token.queuePosition);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const chimePlayedRef = useRef(false);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Play chime when ready
  useEffect(() => {
    if (jobStatus === "ready_for_pickup" && !chimePlayedRef.current) {
      chimePlayedRef.current = true;
      playChime();
      // Auto-transition to pickup after 2s
      const timer = setTimeout(onPickupReady, 2000);
      return () => clearTimeout(timer);
    }
  }, [jobStatus, onPickupReady]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const statusIndex = STATUS_STEPS.findIndex((s) => s.key === jobStatus);

  return (
    <div className="animate-fade-in-up text-center space-y-4">
      <div className="glass rounded-2xl p-6 glow-sm">
        {/* Token display */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-full bg-[--color-accent]/10 border border-[--color-accent]/30 flex items-center justify-center">
            <span className="text-lg font-bold gradient-text">
              {token.tokenCode}
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Your Token</p>
            <p className="text-xs text-[--color-muted]">
              Elapsed: {formatTime(elapsedSeconds)}
            </p>
          </div>
        </div>

        {/* Status pipeline */}
        <div className="flex items-center justify-between mb-6 px-2">
          {STATUS_STEPS.map((step, i) => {
            const isActive = step.key === jobStatus;
            const isComplete = i < statusIndex;
            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-all duration-500 ${
                      isComplete || isActive
                        ? "bg-gradient-to-r from-[--color-accent] to-[--color-success]"
                        : "bg-[--color-border]"
                    }`}
                  />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive
                        ? "bg-[--color-accent]/20 border-2 border-[--color-accent] scale-110"
                        : isComplete
                        ? "bg-[--color-success]/20 border-2 border-[--color-success]"
                        : "bg-[--color-surface-light] border-2 border-[--color-border]"
                    }`}
                  >
                    <span className="text-base">{step.icon}</span>
                  </div>
                  <span
                    className={`text-[10px] font-medium ${
                      isActive
                        ? "text-[--color-accent-light]"
                        : isComplete
                        ? "text-[--color-success]"
                        : "text-[--color-muted]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Status detail */}
        {jobStatus === "queued" && (
          <div className="p-4 rounded-xl bg-[--color-surface-light] animate-shimmer">
            <p className="text-sm font-medium mb-1">Waiting in Queue</p>
            <p className="text-xs text-[--color-muted]">
              Position:{" "}
              <span className="font-bold text-[--color-accent-light]">
                #{currentPosition}
              </span>
            </p>
            <p className="text-[11px] text-[--color-muted] mt-1">
              Your files are queued and will be printed shortly
            </p>
          </div>
        )}

        {jobStatus === "printing" && (
          <div className="p-4 rounded-xl bg-[--color-accent]/5 border border-[--color-accent]/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-4 h-4 border-2 border-[--color-accent] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-[--color-accent-light]">
                Printing Now
              </p>
            </div>
            <p className="text-xs text-[--color-muted]">
              Your documents are being printed right now
            </p>
          </div>
        )}

        {jobStatus === "ready_for_pickup" && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm font-bold text-[--color-success] mb-1">
              🎉 Ready for Pickup!
            </p>
            <p className="text-xs text-[--color-muted]">
              Collect your prints from the counter
            </p>
          </div>
        )}
      </div>

      {/* Dev controls for testing status transitions */}
      <div className="glass rounded-xl p-3 glow-sm">
        <p className="text-[10px] text-[--color-muted] mb-2">[Dev] Simulate Status</p>
        <div className="flex gap-2">
          <button
            onClick={() => onStatusChange("queued")}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              jobStatus === "queued"
                ? "bg-[--color-accent]/20 text-[--color-accent-light]"
                : "bg-[--color-surface-light] text-[--color-muted]"
            }`}
          >
            Queued
          </button>
          <button
            onClick={() => onStatusChange("printing")}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              jobStatus === "printing"
                ? "bg-[--color-accent]/20 text-[--color-accent-light]"
                : "bg-[--color-surface-light] text-[--color-muted]"
            }`}
          >
            Printing
          </button>
          <button
            onClick={() => onStatusChange("ready_for_pickup")}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              jobStatus === "ready_for_pickup"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold"
                : "bg-[--color-surface-light] text-[--color-muted]"
            }`}
          >
            Ready
          </button>
        </div>
      </div>
    </div>
  );
}
