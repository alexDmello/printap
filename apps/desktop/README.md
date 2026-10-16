# Printap — Shopkeeper Counter Agent (`@printap/desktop`)

> Desktop client running on physical print shop counters. Manages hardware printers, handles incoming peer-to-peer WebRTC document streams, and executes local FIFO queue dispatching.

---

## 💻 Tech Stack
- **Framework**: Electron + Vite (`electron-vite`)
- **UI**: React 19 + TypeScript
- **Styling**: High-Contrast Structural Design System (`Space Grotesk`, `JetBrains Mono`)
- **Printer Spooling**: Native Node.js child processes querying Windows PnP (`Get-Printer`, `Win32_Printer`)
- **Signaling**: Supabase Realtime Broadcast

---

## 🏃 Running Locally

```bash
# From workspace root
npm run dev:desktop
```

## 📦 Building Installer

```bash
# Compiles code & packages Windows NSIS installer to apps/desktop/dist/
npm run dist:desktop
```

---

## 🧩 Key Architecture
- **`src/main/`**: Electron background process, window lifecycle, updater events, native OS dialogs.
- **`src/preload/`**: Secure context bridge exposing strictly typed IPC methods (`window.electronAPI`).
- **`src/renderer/`**: React application:
  - `components/LiveDashboard.tsx`: Active orders, real-time file receipt progress, queue actions.
  - `components/PrintersControl.tsx`: Physical hardware verification, port binding (`USB`, `WSD`, `TCP/IP`).
  - `components/ServicesRates.tsx`: Rate card editor for B&W, Color, and finishing services.
  - `components/CounterQr.tsx`: High-resolution acrylic standee and QR code generator.
  - `lib/fifo-dispatcher.ts`: Atomic FIFO sequence generator with daily rollover.
  - `lib/shop-signaling.ts`: WebRTC RTCPeerConnection receiver and DataChannel stream accumulator.
