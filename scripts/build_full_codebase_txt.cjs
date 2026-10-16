const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "PRINTAP_CODEBASE_REVIEW.txt");

const filesToInclude = [
  // ─── Project Config & Database ───
  { path: "package.json", desc: "Monorepo Root Package Configuration" },
  { path: "supabase/schema.sql", desc: "Core Supabase SQL Schema (Tables, RLS, Functions)" },
  { path: "supabase/migrations/002_print_orders_and_queue.sql", desc: "SQL Migration: Print Orders Table & Queue System" },
  { path: "supabase/migrations/003_shop_services_and_pricing.sql", desc: "SQL Migration: Shop Services & Tier Pricing" },
  { path: "supabase/migrations/004_shop_online_status.sql", desc: "SQL Migration: Shop Online/Offline Presence Sync" },
  { path: "supabase/migrations/008_analytics_and_archival_system.sql", desc: "SQL Migration: Revenue Ledger & Archival System" },
  { path: "supabase/migrations/009_shop_owner_auth_and_location.sql", desc: "SQL Migration: Shop Owner Auth & Location Profiles" },
  { path: "supabase/migrations/013_shop_tokens.sql", desc: "SQL Migration: Token Ledger & Subscription Balance" },
  { path: "supabase/migrations/014_token_escrow_and_refunds.sql", desc: "SQL Migration: Atomic Token Escrow & Automatic Refunds" },
  { path: "supabase/migrations/016_platform_admins.sql", desc: "SQL Migration: Platform Admin Permissions & RLS" },

  // ─── Shared Core Package ───
  { path: "packages/shared/package.json", desc: "Shared Package Definition" },
  { path: "packages/shared/src/index.ts", desc: "Shared Package Main Exports" },
  { path: "packages/shared/src/supabase.ts", desc: "Shared Supabase Client, Domain Sanitizer, Types" },
  { path: "packages/shared/src/signaling.ts", desc: "Shared Signaling Constants, Message Types, Payloads" },

  // ─── Desktop App (Shop Terminal & Hardware Agent) ───
  { path: "apps/desktop/package.json", desc: "Desktop Electron App Package Configuration" },
  { path: "apps/desktop/electron.vite.config.ts", desc: "Electron-Vite Build & Alias Configuration" },
  { path: "apps/desktop/electron-builder.yml", desc: "Electron-Builder Windows Packaging Configuration" },
  { path: "apps/desktop/src/main/index.ts", desc: "Electron Main Process: Window Lifecycle, PDF Spooler IPC, Shutdown Cleanup" },
  { path: "apps/desktop/src/main/printer-discovery.ts", desc: "Windows PowerShell Hardware Printer Discovery Engine" },
  { path: "apps/desktop/src/preload/index.ts", desc: "Electron Preload Script (Typed ContextBridge IPC API)" },
  { path: "apps/desktop/src/renderer/env.d.ts", desc: "Renderer Ambient TypeScript Types & Window Declarations" },
  { path: "apps/desktop/src/renderer/main.tsx", desc: "Renderer React DOM Root Entrypoint" },
  { path: "apps/desktop/src/renderer/App.tsx", desc: "Renderer App Shell: Page Navigation, Presence Sync, Dispatcher Orchestrator" },
  { path: "apps/desktop/src/renderer/context/AuthContext.tsx", desc: "Authentication Context: Local Session, OTP Reset, Google OAuth" },
  { path: "apps/desktop/src/renderer/lib/shop-signaling.ts", desc: "WebRTC Receiver & Signaling Channel: SDP Handshake, Chunk Assembler" },
  { path: "apps/desktop/src/renderer/lib/shop-presence.ts", desc: "Supabase Realtime Shop Presence & Heartbeat Engine" },
  { path: "apps/desktop/src/renderer/lib/fifo-dispatcher.ts", desc: "FIFO Print Dispatcher: Queue Scheduler, Token Allocation, Hardware Spooler" },
  { path: "apps/desktop/src/renderer/components/Sidebar.tsx", desc: "Navigation Sidebar & Live Online/Offline Toggle" },
  { path: "apps/desktop/src/renderer/components/LiveDashboard.tsx", desc: "Live Monitor: Active Print Progress, Live Queue, Handover Ledger" },
  { path: "apps/desktop/src/renderer/components/PrintHistory.tsx", desc: "Print History & Activity Ledger with CSV Export" },
  { path: "apps/desktop/src/renderer/components/PrintersControl.tsx", desc: "Hardware Printer Mapping & Capability Assignment" },
  { path: "apps/desktop/src/renderer/components/ServicesRates.tsx", desc: "Shop Services, Rate Card & Document Pricing Matrix" },
  { path: "apps/desktop/src/renderer/components/Analytics.tsx", desc: "Financial Metrics, Print Volume Charts, Revenue Summary" },
  { path: "apps/desktop/src/renderer/components/CounterQr.tsx", desc: "Customer QR Code Stand Generator & Print Sheet" },
  { path: "apps/desktop/src/renderer/components/Tokens.tsx", desc: "Token Management Deck: Balances, Threshold Alerts, Pack Top-Up" },
  { path: "apps/desktop/src/renderer/components/Profile.tsx", desc: "Shop Information, Operating Hours & Geolocation Configuration" },
  { path: "apps/desktop/src/renderer/components/Login.tsx", desc: "Shopkeeper Counter Terminal Authentication & Password Reset" },
  { path: "apps/desktop/src/renderer/components/UpdateScreen.tsx", desc: "Software Auto-Updater Modal (Download Progress & Restart)" },
  { path: "apps/desktop/src/renderer/components/UnsavedChangesModal.tsx", desc: "Modal Guard for Unsaved Changes Across Forms" },
  { path: "apps/desktop/src/renderer/components/ErrorBoundary.tsx", desc: "Global React Exception Boundary" },
  { path: "apps/desktop/src/renderer/components/Icons.tsx", desc: "SVG Icon Set" },
  { path: "apps/desktop/src/renderer/styles.css", desc: "High-Contrast Structural Design System Stylesheet" },

  // ─── Customer Web Reference (WebRTC Client) ───
  { path: "apps/web/src/lib/customer-signaling.ts", desc: "Customer WebRTC Peer: SDP Offer, Chunked File Streaming, Status Listener" }
];

let output = "";

// ─── Header & Architectural Documentation ───
output += `═══════════════════════════════════════════════════════════════════════════════
  PRINTAP — PRIVACY-FIRST PEER-TO-PEER DOCUMENT PRINTING PLATFORM
  COMPREHENSIVE CODEBASE SPECIFICATION & FULL SOURCE CODE AUDIT
═══════════════════════════════════════════════════════════════════════════════

Generated: ${new Date().toISOString()}
Target Stack: Electron 33, React 19, TypeScript 5.7, Vite 5, Supabase (PostgreSQL 15), WebRTC DataChannel

───────────────────────────────────────────────────────────────────────────────
1. ARCHITECTURAL OVERVIEW & HIGH-LEVEL SYSTEM DESIGN
───────────────────────────────────────────────────────────────────────────────
Printap eliminates cloud storage risks for commercial document printing (Xerox / print shops).
In traditional print shops, customers email or WhatsApp sensitive PDFs (legal documents, Aadhaar cards,
academic certificates, medical records) to public computers where they persist unencrypted on disk.

Printap replaces this with a ZERO-CLOUD-STORAGE peer-to-peer streaming pipeline:
1. CUSTOMER EXPERIENCE (Web PWA):
   - The customer scans a dynamic counter QR code at the physical counter.
   - A client-side PWA opens in their mobile browser (no mobile app installation required).
   - The customer selects PDF/image documents and configures print parameters (color/BW, copies, duplex, page range).
   - Dynamic client-side pricing calculates costs in real-time according to the shop's active rate matrix.

2. PEER-TO-PEER DATA PIPELINE (WebRTC DataChannel):
   - Customer and Shop negotiate an encrypted WebRTC PeerConnection via Supabase Realtime Broadcast signaling.
   - Files are sliced into 64KB binary chunks and streamed DIRECTLY from the customer's mobile browser to the shop desktop terminal over an encrypted RTCDataChannel.
   - ZERO file bytes are ever uploaded to, or stored on, Supabase storage or cloud servers.
   - SHA-256 chunk checksums verify end-to-end payload integrity before spooling.

3. COUNTER TERMINAL AGENT (Electron Desktop App):
   - Runs locally on the shopkeeper's counter PC (Windows).
   - Automatically discovers physical hardware printers via native PowerShell/WMI and excludes virtual queues (PDF writers, OneNote, fax).
   - Maps document print settings (B&W vs Color, A4 vs A3) to target physical printers.
   - Manages a local FIFO spooling queue with atomic Token verification.
   - Streams PDF buffers directly into the Windows native print spooler (\`pdf-to-printer\`).
   - Implements SECURE SHREDDING (\`secure-rm\` multi-pass overwrite) immediately after physical spooling completes.

4. TOKEN & ESCROW MONETIZATION ENGINE:
   - Each print transaction requires 1 Printap Token.
   - PostgreSQL RPCs (\`escrow_shop_tokens\`, \`consume_escrowed_token\`, \`release_escrowed_token\`) enforce atomic token balance verification.
   - Tokens are escrowed upon WebRTC handshake and atomically consumed only when the physical print job succeeds.
   - If the printer jams, runs out of paper, or the customer cancels, the escrowed token is instantly refunded back to the shop's balance.

───────────────────────────────────────────────────────────────────────────────
2. MONOREPO STRUCTURE & DATA FLOW MAP
───────────────────────────────────────────────────────────────────────────────
mellod/printap/
├── apps/
│   ├── desktop/             # Electron + React Counter Terminal App (Shopkeeper Agent)
│   │   ├── src/
│   │   │   ├── main/        # Electron Main Process (Spooler, Discovery, Window Lifecycle)
│   │   │   ├── preload/     # ContextBridge IPC Layer
│   │   │   └── renderer/    # React 19 Frontend (Workspace, Live Monitor, Settings)
│   │   └── electron.vite.config.ts
│   ├── admin-desktop/       # Standalone Executive/Super-Admin Oversight Console
│   └── web/                 # Customer-facing Next.js PWA (WebRTC Sender, QR scan destination)
├── packages/
│   └── shared/              # Shared types, Supabase client factory, signaling contracts
└── supabase/
    ├── schema.sql           # Base database schema (Tables, RLS, Functions)
    └── migrations/          # Incremental database migrations (Tokens, Escrow, Pricing)

───────────────────────────────────────────────────────────────────────────────
3. TABLE OF CONTENTS OF INCLUDED FILES
───────────────────────────────────────────────────────────────────────────────
`;

filesToInclude.forEach((item, index) => {
  const fullPath = path.join(ROOT_DIR, item.path);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    const lines = fs.readFileSync(fullPath, "utf8").split("\n").length;
    output += `[${String(index + 1).padStart(2, "0")}] ${item.path.padEnd(55)} (${(stats.size / 1024).toFixed(1)} KB, ${lines} lines) — ${item.desc}\n`;
  } else {
    output += `[${String(index + 1).padStart(2, "0")}] ${item.path.padEnd(55)} (MISSING) — ${item.desc}\n`;
  }
});

output += `\n═══════════════════════════════════════════════════════════════════════════════
  SOURCE CODE LISTINGS
═══════════════════════════════════════════════════════════════════════════════\n\n`;

filesToInclude.forEach((item, index) => {
  const fullPath = path.join(ROOT_DIR, item.path);
  output += `───────────────────────────────────────────────────────────────────────────────\n`;
  output += `FILE [${index + 1}/${filesToInclude.length}]: ${item.path}\n`;
  output += `PURPOSE: ${item.desc}\n`;
  output += `───────────────────────────────────────────────────────────────────────────────\n`;

  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf8");
    output += content + "\n\n";
  } else {
    output += `/* FILE NOT FOUND ON DISK: ${item.path} */\n\n`;
  }
});

output += `═══════════════════════════════════════════════════════════════════════════════
  END OF PRINTAP CODEBASE DUMP
═══════════════════════════════════════════════════════════════════════════════\n`;

fs.writeFileSync(OUTPUT_FILE, output, "utf8");
const finalStats = fs.statSync(OUTPUT_FILE);
console.log(`Successfully generated: ${OUTPUT_FILE}`);
console.log(`Total File Size: ${(finalStats.size / (1024 * 1024)).toFixed(2)} MB (${(finalStats.size / 1024).toFixed(1)} KB)`);
console.log(`Total Lines: ${output.split("\n").length}`);
