"use client";

import React, { useEffect, useState } from "react";
import type { QueueToken } from "@printap/shared";

interface TokenConfirmationProps {
  token: QueueToken;
  onContinue: () => void;
}

export default function TokenConfirmation({
  token,
  onContinue,
}: TokenConfirmationProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Stagger the entrance animation
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="animate-fade-in-up text-center space-y-4">
      {/* Token badge */}
      <div className="glass rounded-2xl p-8 glow-sm">
        <div
          className={`transition-all duration-700 ${
            showContent ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          {/* Token circle */}
          <div className="relative w-28 h-28 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 animate-pulse-glow" />
            <div className="w-28 h-28 rounded-full bg-[--color-surface] border-2 border-[--color-accent]/40 flex items-center justify-center">
              <span className="text-3xl font-bold gradient-text">
                {token.tokenCode}
              </span>
            </div>
          </div>

          <h2 className="text-lg font-bold mb-1">Your Queue Token</h2>
          <p className="text-sm text-[--color-muted]">
            You are{" "}
            <span className="text-[--color-accent-light] font-semibold">
              #{token.queuePosition}
            </span>{" "}
            in line
          </p>
          {token.estimatedWaitMinutes > 0 && (
            <p className="text-xs text-[--color-muted] mt-1">
              Estimated wait: ~{token.estimatedWaitMinutes} min
            </p>
          )}
        </div>
      </div>

      {/* Track button */}
      <button
        onClick={onContinue}
        className="btn-primary w-full py-3.5 rounded-xl font-semibold text-white text-sm tracking-wide"
      >
        Track Live Queue →
      </button>
    </div>
  );
}
