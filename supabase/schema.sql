-- ============================================================
-- Printap — Supabase SQL Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. SHOPS TABLE
-- Stores each registered xerox shop.
CREATE TABLE public.shops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,              -- e.g. "rahuls-xerox" for {slug}.mellod.in
  upi_vpa     TEXT NOT NULL,            -- e.g. "shop@upi"
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick status lookups (kill-switch check) and subdomain routing
CREATE INDEX idx_shops_status ON public.shops (status);
CREATE UNIQUE INDEX idx_shops_slug ON public.shops (slug);

COMMENT ON TABLE  public.shops IS 'Registered xerox shops on the Printap platform.';
COMMENT ON COLUMN public.shops.slug IS 'Unique URL-safe slug for subdomain routing ({slug}.mellod.in).';
COMMENT ON COLUMN public.shops.upi_vpa IS 'UPI Virtual Payment Address for dynamic QR generation.';
COMMENT ON COLUMN public.shops.status  IS 'active = accepting jobs, suspended = dues unpaid (kill-switch).';


-- 2. PRINT_EVENTS TABLE
-- One row per successful print session. Used for billing (₹1/print).
CREATE TABLE public.print_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,             -- correlates WebRTC session
  fee_amount  NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for weekly invoice aggregation
CREATE INDEX idx_print_events_shop_created
  ON public.print_events (shop_id, created_at DESC);

COMMENT ON TABLE  public.print_events IS 'Ledger of completed print jobs; each row = ₹1 platform fee.';
COMMENT ON COLUMN public.print_events.session_id IS 'Opaque session identifier from the WebRTC handshake.';


-- 3. ROW LEVEL SECURITY (RLS)
-- Enable RLS on both tables.
ALTER TABLE public.shops        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_events ENABLE ROW LEVEL SECURITY;

-- ---- SHOPS POLICIES ----

-- Anyone (anon) can READ a shop's public info (needed for the customer web app
-- to fetch shop name, UPI VPA, and status before initiating a session).
CREATE POLICY "shops_select_public"
  ON public.shops FOR SELECT
  USING (true);

-- Only service_role (backend/admin) can INSERT/UPDATE/DELETE shops.
-- (Shop registration is an admin operation, not done from the client.)
CREATE POLICY "shops_insert_service_role"
  ON public.shops FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "shops_update_service_role"
  ON public.shops FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "shops_delete_service_role"
  ON public.shops FOR DELETE
  USING (auth.role() = 'service_role');

-- ---- PRINT_EVENTS POLICIES ----

-- The Electron agent (authenticated as anon with shop_id context) can INSERT
-- print events. We allow anon inserts because the desktop agent logs events
-- after a successful print, and it uses the anon key.
CREATE POLICY "print_events_insert_anon"
  ON public.print_events FOR INSERT
  WITH CHECK (true);

-- Only service_role can SELECT print_events (for invoicing / admin dashboard).
CREATE POLICY "print_events_select_service_role"
  ON public.print_events FOR SELECT
  USING (auth.role() = 'service_role');

-- No UPDATE or DELETE on print_events (immutable ledger).


-- 4. REALTIME — enable the signaling channel
-- Supabase Realtime Broadcast doesn't need a table, but if you want to use
-- Realtime Postgres Changes on print_events (e.g. for a live dashboard):
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_events;


-- 5. PRINTER ASSIGNMENTS TABLE
-- Maps OS printer names to roles (B&W, Color, Both) per shop.
CREATE TABLE public.printer_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  printer_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'bw'
                  CHECK (role IN ('bw', 'color', 'both')),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_printer_assignments_unique
  ON public.printer_assignments (shop_id, printer_name);

ALTER TABLE public.printer_assignments ENABLE ROW LEVEL SECURITY;

-- Anon can read and write printer assignments (Electron agent uses anon key)
CREATE POLICY "printer_assignments_select_anon"
  ON public.printer_assignments FOR SELECT
  USING (true);

CREATE POLICY "printer_assignments_insert_anon"
  ON public.printer_assignments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "printer_assignments_update_anon"
  ON public.printer_assignments FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "printer_assignments_delete_anon"
  ON public.printer_assignments FOR DELETE
  USING (true);

COMMENT ON TABLE  public.printer_assignments IS 'Maps OS printers to roles per shop.';
COMMENT ON COLUMN public.printer_assignments.role IS 'bw = black & white, color = color, both = either.';


-- ============================================================
-- SEED DATA (optional — insert a test shop for development)
-- ============================================================
-- INSERT INTO public.shops (name, upi_vpa)
-- VALUES ('Dev Print Shop', 'devshop@upi');
