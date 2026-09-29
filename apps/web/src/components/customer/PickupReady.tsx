"use client";

import React, { useEffect, useRef, useState } from "react";
import type { QueueToken } from "@printap/shared";

interface PickupReadyProps {
  token: QueueToken;
  onPrintAnother: () => void;
}

/**
 * Lightweight canvas-confetti implementation using pure Canvas API.
 */
function fireConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    "#6366f1", "#a78bfa", "#c084fc", "#34d399",
    "#818cf8", "#f472b6", "#fbbf24", "#22d3ee",
  ];

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    gravity: number;
    opacity: number;
    decay: number;
  }

  const particles: Particle[] = [];

  // Generate particles from two origins
  for (let i = 0; i < 80; i++) {
    const originX = canvas.width * (0.3 + Math.random() * 0.4);
    particles.push({
      x: originX,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 15 - 5,
      width: Math.random() * 8 + 4,
      height: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.15 + Math.random() * 0.1,
      opacity: 1,
      decay: 0.005 + Math.random() * 0.005,
    });
  }

  let frame = 0;
  const maxFrames = 180;

  function animate() {
    if (frame >= maxFrames) {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    frame++;

    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0) continue;

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate((p.rotation * Math.PI) / 180);
      ctx!.globalAlpha = Math.max(0, p.opacity);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      ctx!.restore();
    }

    requestAnimationFrame(animate);
  }

  animate();
}

export default function PickupReady({ token, onPrintAnother }: PickupReadyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      fireConfetti(canvasRef.current);
    }
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="animate-fade-in-up text-center relative">
      {/* Confetti canvas (fullscreen overlay) */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50"
      />

      <div className="glass rounded-2xl p-8 glow-success relative z-10">
        <div
          className={`transition-all duration-700 ${
            showContent ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          {/* Success icon */}
          <div className="animate-checkmark-pop">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <span className="text-4xl">🎉</span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-[--color-success] mb-1">
            Ready for Pickup!
          </h2>
          <p className="text-sm text-[--color-muted] mb-6">
            Collect your prints from the counter
          </p>

          {/* Token & PIN Card */}
          <div className="p-5 rounded-xl bg-[--color-surface-light] space-y-4">
            {/* Token */}
            <div>
              <p className="text-xs text-[--color-muted] mb-1">Your Token</p>
              <p className="text-4xl font-bold gradient-text">
                {token.tokenCode}
              </p>
            </div>

            {/* PIN */}
            <div className="border-t border-[--color-border] pt-4">
              <p className="text-xs text-[--color-muted] mb-2">Pickup PIN</p>
              <div className="flex items-center justify-center gap-2">
                {token.pickupPin.split("").map((digit, i) => (
                  <div
                    key={i}
                    className="w-12 h-14 rounded-lg bg-[--color-surface] border border-[--color-accent]/30 flex items-center justify-center text-2xl font-mono font-bold text-[--color-accent-light]"
                  >
                    {digit}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[--color-muted] mt-2">
                Show this PIN to the counter operator
              </p>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center justify-center gap-2">
            <svg
              className="w-4 h-4 text-emerald-600 shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-emerald-800 font-medium">
              Document securely shredded from printer memory
            </span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onPrintAnother}
          className="mt-5 px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition-all w-full shadow-sm"
        >
          Print Another Document
        </button>
      </div>
    </div>
  );
}
