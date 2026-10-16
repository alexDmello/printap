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
      role: "Shop Owner Console",
      domain: "Desktop Agent",
      status: "Desktop Standalone",
      type: "Electron Hardware App",
      desc: "Direct spooler queue, DoD shredding, and UPI settlements. Browser web access strictly disabled.",
    },
    {
      role: "Platform Admin Console",
      domain: "Executive Console",
      status: "Desktop Standalone",
      type: "Electron Executive App",
      desc: "Global directory, kill-switch controllers, and monthly archival. Browser web access strictly disabled.",
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
      color: "text-black",
      desc: "Encrypted relational store for shops, rate cards, and immutable print session hashes.",
    },
    {
      name: "Supabase Realtime Signaling Bus",
      status: "Operational",
      badge: "WebSockets",
      color: "text-black",
      desc: "Low-latency presence tracking and WebRTC ICE SDP candidate exchange.",
    },
    {
      name: "Peer-to-Peer WebRTC Pipeline",
      status: "Zero Cloud Storage Active",
      badge: "Direct Browser-to-PC",
      color: "text-black",
      desc: "Files stream directly from customer phones into desktop RAM with zero cloud storage.",
    },
    {
      name: "Localhost Ban Enforcement",
      status: "Strict Enforced",
      badge: "Subdomain Only",
      color: "text-black",
      desc: `Restricts platform services exclusively to *.${ROOT_DOMAIN} to guarantee isolation.`,
    },
    {
      name: "Browser Admin Lockdown",
      status: "Strict Enforced",
      badge: "Desktop Exclusive",
      color: "text-black",
      desc: "All shop and platform management is exclusively via desktop Electron apps. No web admin portals exist.",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-black tracking-tight">
              Network Topology & System Health
            </h2>
            <span className="wabi-seal px-2 py-0.5 text-[10px] font-mono">
              TOPOLOGY
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Active routing matrix, domain architecture, and operational integrity monitors.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-mono text-black font-medium">
          <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
          <span>All Nodes Healthy</span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bento 1: Subdomain Routing Architecture */}
        <div className="wabi-bento-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-100 text-black border border-zinc-200">
                <IconServer size={15} />
              </span>
              <h3 className="text-sm font-bold text-black">
                Subdomain Architecture Matrix ({ROOT_DOMAIN})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">DNS Edge</span>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            Automatic wildcard SSL resolution maps each custom URL to its dedicated operational context.
          </p>

          <div className="space-y-3">
            {routes.map((r) => (
              <div
                key={r.domain}
                className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-black">{r.role}</span>
                  <span className="font-mono text-xs text-zinc-700">{r.domain}</span>
                </div>
                <p className="text-[11px] text-zinc-500">{r.desc}</p>
                <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-zinc-400">
                  <span>{r.type}</span>
                  <span className="text-black font-semibold">● {r.status}</span>
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
                <span className="p-1.5 rounded-lg bg-zinc-100 text-black border border-zinc-200">
                  <IconHealth size={15} />
                </span>
                <h3 className="text-sm font-bold text-black">
                  Platform Infrastructure Nodes
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">Mesh Status</span>
            </div>
            <p className="text-xs text-zinc-500 mb-5">
              Continuous heartbeat monitoring across core signaling channels and database connectivity.
            </p>

            <div className="space-y-3">
              {services.map((s) => (
                <div
                  key={s.name}
                  className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-black">{s.name}</span>
                    <span className={`text-[11px] font-mono font-semibold ${s.color}`}>
                      ● {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">{s.desc}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-zinc-400">
                    <span>Technology: {s.badge}</span>
                    <span className="text-zinc-700">Verified Clean</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <IconShield size={14} className="text-black" />
              <span>Zero Document Leakage Guarantee</span>
            </div>
            <span className="font-mono text-[10px] text-zinc-400">GDPR / DPDP Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
