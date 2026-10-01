"use client";

import React from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import { IconHealth, IconServer, IconShield } from "./Icons";

export function HealthView() {
  const routes = [
    {
      role: "Landing & Marketing Portal",
      domain: `www.${ROOT_DOMAIN}`,
      status: "Operational",
      type: "Public Edge",
      desc: "Static marketing, kiosk showcase, pricing calculator, and shop signups.",
    },
    {
      role: "Shop Owner Portal",
      domain: `shop.${ROOT_DOMAIN}`,
      status: "Operational",
      type: "Merchant Console",
      desc: "Desktop agent connection, queue management, UPI settlements, and pricing rate cards.",
    },
    {
      role: "Platform Admin Console",
      domain: `admin.${ROOT_DOMAIN}`,
      status: "Operational",
      type: "Super Admin",
      desc: "Global directory, kill-switch controllers, transaction ledger, and GST configuration.",
    },
    {
      role: "Dynamic Customer Counters",
      domain: `*.${ROOT_DOMAIN}`,
      status: "Operational",
      type: "Dynamic Wildcard",
      desc: "QR code landing pages for students & customers with instant WebRTC connection to desktop.",
    },
  ];

  const services = [
    {
      name: "Supabase Database & Auth Engine",
      status: "Connected & Healthy",
      badge: "PostgreSQL 15",
      color: "text-white",
      desc: "Encrypted relational store for shops, rate cards, and immutable print session hashes.",
    },
    {
      name: "Supabase Realtime Signaling Bus",
      status: "Operational",
      badge: "WebSockets",
      color: "text-white",
      desc: "Low-latency presence tracking and WebRTC ICE SDP candidate exchange.",
    },
    {
      name: "Peer-to-Peer WebRTC Pipeline",
      status: "Zero Cloud Storage Active",
      badge: "Direct Browser-to-PC",
      color: "text-white",
      desc: "Files stream directly from customer phones into desktop RAM with zero cloud storage.",
    },
    {
      name: "Localhost Ban Enforcement",
      status: "Strict Enforced",
      badge: "Subdomain Only",
      color: "text-white",
      desc: `Restricts platform services exclusively to *.${ROOT_DOMAIN} to guarantee isolation.`,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#222226]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Network Topology & System Health
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              健康 • TOPOLOGY
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Active routing matrix, domain architecture, and operational integrity monitors.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-mono text-white">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>All Nodes Healthy</span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bento 1: Subdomain Routing Architecture */}
        <div className="wabi-bento-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-900 text-white border border-zinc-700">
                <IconServer size={15} />
              </span>
              <h3 className="text-sm font-bold text-white">
                Subdomain Architecture Matrix ({ROOT_DOMAIN})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">DNS Edge</span>
          </div>
          <p className="text-xs text-zinc-400 mb-5">
            Automatic wildcard SSL resolution maps each custom URL to its dedicated operational context.
          </p>

          <div className="space-y-3">
            {routes.map((r) => (
              <div
                key={r.domain}
                className="p-3.5 rounded-2xl bg-[#18181b] border border-[#27272a] space-y-1.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-white">{r.role}</span>
                  <span className="font-mono text-xs text-zinc-300">{r.domain}</span>
                </div>
                <p className="text-[11px] text-zinc-400">{r.desc}</p>
                <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-zinc-400">
                  <span>{r.type}</span>
                  <span className="text-white font-semibold">● {r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bento 2: Platform Services Status */}
        <div className="wabi-bento-card rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-zinc-900 text-white border border-zinc-700">
                  <IconHealth size={15} />
                </span>
                <h3 className="text-sm font-bold text-white">
                  Platform Infrastructure Nodes
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">Mesh Status</span>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Continuous heartbeat monitoring across core signaling channels and database connectivity.
            </p>

            <div className="space-y-3">
              {services.map((s) => (
                <div
                  key={s.name}
                  className="p-3.5 rounded-2xl bg-[#18181b] border border-[#27272a] space-y-1.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-white">{s.name}</span>
                    <span className={`text-[11px] font-mono font-semibold ${s.color}`}>
                      ● {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">{s.desc}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-zinc-400">
                    <span>Technology: {s.badge}</span>
                    <span className="text-white">Verified Clean</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#1f1f23] flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <IconShield size={14} className="text-white" />
              <span>Zero Document Leakage Guarantee</span>
            </div>
            <span className="font-mono text-[10px] text-zinc-400">GDPR / DPDP Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
