# Printap — Executive Console (`@printap/admin-desktop`)

> Desktop management terminal for platform administrators. Provides real-time network node telemetry, fleet health monitoring, platform fee governance, and shop offboarding.

---

## 💻 Tech Stack
- **Framework**: Electron + Vite (`electron-vite`)
- **UI**: React 19 + TypeScript + Tailwind CSS v4
- **Styling**: Monochromatic High-Contrast System (`#F0EBED` canvas, `#16181D` pillars, `#FFFFFF` glow cards)

---

## 🏃 Running Locally

```bash
# From workspace root
npm run dev:admin-desktop
```

## 📦 Building Installer

```bash
# Compiles code & packages Windows NSIS installer to apps/admin-desktop/dist/
npm run dist:admin-desktop
```

---

## 🧩 Views & Operations
- **Command Deck (`OverviewView`)**: Network-wide active nodes, daily document volume, token reserve statistics.
- **Terminal Nodes (`ShopsView`)**: Comprehensive shop registry, subdomain routing, and terminal configuration.
- **Fee Matrix (`PricingView`)**: Global platform infrastructure fee and GST tax percentage governance.
- **System Telemetry (`HealthView`)**: Edge latency benchmarks, database connection pools, and heartbeat trackers.
- **Settlement Ledger (`LedgerView`)**: Token escrow transaction audit trail and shop ledger records.
