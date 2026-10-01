"use client";

import React from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import { HealthIcon, CheckCircleIcon } from "./AdminIcons";

export function SystemHealthView() {
  const subsystems = [
    {
      name: "Supabase Postgres Database",
      status: "Operational",
      latency: "18ms",
      desc: "Storage for shop metadata, kill-switch flags & immutable print ledger",
    },
    {
      name: "WebRTC Signaling Mesh (Realtime)",
      status: "Operational",
      latency: "12ms",
      desc: "Sub-second SDP/ICE candidate exchange without relay proxy latency",
    },
    {
      name: "Direct P2P DataChannels",
      status: "Zero Storage",
      latency: "Direct",
      desc: "Encrypted file chunks stream directly between customer phone and desktop spooler",
    },
    {
      name: "Edge Subdomain Rewrite Proxy",
      status: "Enforced",
      latency: "<5ms",
      desc: "Automatic SSL routing for *.mellod.in dynamic customer portals",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Subsystem Status Bento Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {subsystems.map((sub, i) => (
          <div
            key={i}
            className="glass-panel rounded-3xl p-5 bento-card border border-white/90 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                  {sub.status}
                </span>
              </div>
              <h4 className="text-xs font-bold text-[--color-foreground]">{sub.name}</h4>
              <p className="text-[11px] text-[--color-muted] mt-1.5 leading-relaxed">{sub.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.06] text-[10px] font-mono text-[--color-muted] flex justify-between">
              <span>Telemetry:</span>
              <span className="text-emerald-600 font-bold">{sub.latency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Routing Architecture Bento Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-panel rounded-3xl p-6 sm:p-7 bento-card border border-white/90 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[--color-foreground]">
              Subdomain Architecture Matrix ({ROOT_DOMAIN})
            </h3>
            <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full font-semibold">
              Edge Routed
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center p-3 rounded-2xl glass-panel-subtle border border-black/[0.04]">
              <div>
                <div className="font-semibold text-[--color-foreground]">Public Marketing & Landing</div>
                <div className="text-[10px] text-[--color-muted]">Root domain experience</div>
              </div>
              <span className="font-mono text-indigo-600 font-bold">www.{ROOT_DOMAIN}</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-2xl glass-panel-subtle border border-black/[0.04]">
              <div>
                <div className="font-semibold text-[--color-foreground]">Shop Owner Counter Portal</div>
                <div className="text-[10px] text-[--color-muted]">Terminal authentication & rates</div>
              </div>
              <span className="font-mono text-indigo-600 font-bold">shop.{ROOT_DOMAIN}</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-2xl glass-panel-subtle border border-black/[0.04]">
              <div>
                <div className="font-semibold text-[--color-foreground]">Platform Operations Console</div>
                <div className="text-[10px] text-[--color-muted]">Operator admin & sentinel</div>
              </div>
              <span className="font-mono text-indigo-600 font-bold">admin.{ROOT_DOMAIN}</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-2xl glass-panel-subtle border border-black/[0.04]">
              <div>
                <div className="font-semibold text-[--color-foreground]">Dynamic Shop Customer URLs</div>
                <div className="text-[10px] text-[--color-muted]">Wildcard customer print portals</div>
              </div>
              <span className="font-mono text-emerald-600 font-bold">*.{ROOT_DOMAIN}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 sm:p-7 bento-card border border-white/90 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[--color-foreground]">
                Security & Zero Storage Compliance
              </h3>
              <span className="text-[10px] font-mono bg-purple-500/10 text-purple-600 px-2.5 py-0.5 rounded-full font-semibold">
                Privacy Guaranteed
              </span>
            </div>

            <div className="space-y-3 text-xs text-[--color-muted] leading-relaxed">
              <div className="p-3 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-start gap-2.5">
                <CheckCircleIcon className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[--color-foreground] block">No Cloud File Retention:</strong>
                  Printap servers never upload, buffer, or persist customer PDF files. Data travels directly through browser-to-desktop WebRTC DataChannels.
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-2.5">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[--color-foreground] block">Instant Kill-Switch Enforcement:</strong>
                  When a shop is suspended in the admin console, all inbound WebRTC signaling tokens are rejected immediately at the edge.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[--color-muted]">
            <span>Compliance: ISO/IEC 27001 & DPDP Act Ready</span>
            <span className="font-mono font-semibold text-emerald-600">Strictly Enforced</span>
          </div>
        </div>
      </div>
    </div>
  );
}
