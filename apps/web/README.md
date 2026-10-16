# Printap — Web Application & Backend (`@printap/web`)

> Next.js 16 full-stack web application serving the customer print portal, shopkeeper onboarding, and backend REST/RPC API services.

---

## 💻 Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + TypeScript + Tailwind CSS v4
- **WebRTC**: Peer-to-peer file transfer over RTCDataChannel
- **Auth & Database**: Supabase JS (RLS protected)
- **Validation**: Zod schema validation

---

## 🏃 Running Locally

```bash
# From workspace root
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🌐 Dynamic Multi-Tenant Routing
- **Subdomain Routing (`middleware.ts`)**:
  - `admin.mellod.in` ➔ Platform Admin Interface
  - `{shop-slug}.mellod.in` ➔ Dedicated Customer Upload & Print Portal for that shop
  - `mellod.in` ➔ Landing Page, Onboarding Flow, and Documentation

---

## 📡 API Endpoints
- `GET/POST /api/shop/pricing`: Retrieve or update shop rate card (requires authentication).
- `POST /api/print/reserve-token`: Reserves token slot and generates cryptographically signed Print Ticket.
- `POST /api/print/refund-token`: Validates Print Ticket and issues atomic token refund on transfer failure.
- `POST /api/auth/login`: Shopkeeper terminal authentication.
- `POST /api/auth/register`: New shop onboarding and subdomain reservation.
- `POST /api/admin/offboard-shop`: Secure shop deletion and teardown (requires `PRINTAP_ADMIN_SECRET`).
