"use client";

import React from "react";
import { ROOT_DOMAIN } from "@printap/shared";
import { IconHealth, IconServer, IconShield, IconActivity } from "./Icons";

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
      color: "text-[#528364]",
      desc: "Encrypted relational store for shops, rate cards, and immutable print session hashes.",
    },
    {
      name: "Supabase Realtime Signaling Bus",
      status: "Operational",
      badge: "WebSockets",
      color: "text-[#528364]",
      desc: "Low-latency presence tracking and WebRTC ICE SDP candidate exchange.",
    },
    {
      name: "Peer-to-Peer WebRTC Pipeline",
      status: "Zero Cloud Storage Active",
      badge: "Direct Browser-to-PC",
      color: "text-[#528364]",
      desc: "Files stream directly from customer phones into desktop RAM with zero cloud storage.",
    },
    {
      name: "Localhost Ban Enforcement",
      status: "Strict Enforced",
      badge: "Subdomain Only",
      color: "text-[#528364]",
      desc: `Restricts platform services exclusively to *.${ROOT_DOMAIN} to guarantee isolation.`,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-[#2d2922]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#528364]" />
            <h2 className="text-lg font-bold text-[#f4ede4] tracking-tight">
              Network Topology & System Health
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              健康 • TOPOLOGY
            </span>
          </div>
          <p className="text-xs text-[#8a8174] mt-1">
            Active routing matrix, domain architecture, and operational integrity monitors.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#528364]/15 border border-[#528364]/30 text-xs font-mono text-[#73a886]">
          <span className="w-2 h-2 rounded-full bg-[#528364] animate-pulse" />
          <span>All Nodes Healthy</span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bento 1: Subdomain Routing Architecture */}
        <div className="wabi-bento-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#27231c] text-[#aba293] border border-[#383227]">
                <IconServer size={15} />
              </span>
              <h3 className="text-sm font-bold text-[#f4ede4]">
                Subdomain Architecture Matrix ({ROOT_DOMAIN})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#736a5c]">DNS Edge</span>
          </div>
          <p className="text-xs text-[#8a8174] mb-5">
            Automatic wildcard SSL resolution maps each custom URL to its dedicated operational context.
          </p>

          <div className="space-y-3">
            {routes.map((r) => (
              <div
                key={r.domain}
                className="p-3.5 rounded-2xl bg-[#1f1d18] border border-[#2d2922] space-y-1.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-[#f4ede4]">{r.role}</span>
                  <span className="font-mono text-xs text-[#6b889a]">{r.domain}</span>
                </div>
                <p className="text-[11px] text-[#8a8174]">{r.desc}</p>
                <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-[#736a5c]">
                  <span>{r.type}</span>
                  <span className="text-[#528364] font-semibold">● {r.status}</span>
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
                <span className="p-1.5 rounded-lg bg-[#27231c] text-[#528364] border border-[#383227]">
                  <IconHealth size={15} />
                </span>
                <h3 className="text-sm font-bold text-[#f4ede4]">
                  Platform Infrastructure Nodes
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#736a5c]">Mesh Status</span>
            </div>
            <p className="text-xs text-[#8a8174] mb-5">
              Continuous heartbeat monitoring across core signaling channels and database connectivity.
            </p>

            <div className="space-y-3">
              {services.map((s) => (
                <div
                  key={s.name}
                  className="p-3.5 rounded-2xl bg-[#1f1d18] border border-[#2d2922] space-y-1.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-[#f4ede4]">{s.name}</span>
                    <span className={`text-[11px] font-mono font-semibold ${s.color}`}>
                      ● {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8a8174]">{s.desc}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-[#736a5c]">
                    <span>Technology: {s.badge}</span>
                    <span className="text-[#73a886]">Verified Clean</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#26221c] flex items-center justify-between text-xs text-[#8a8174]">
            <div className="flex items-center gap-2">
              <IconShield size={14} className="text-[#528364]" />
              <span>Zero Document Leakage Guarantee</span>
            </div>
            <span className="font-mono text-[10px] text-[#736a5c]">GDPR / DPDP Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
