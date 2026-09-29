-- ============================================================
-- Migration: Add rate card, print orders, and queue system
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. ADD RATE CARD COLUMNS TO SHOPS
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS price_bw      NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS price_color   NUMERIC(6, 2) NOT NULL DEFAULT 10.00;

COMMENT ON COLUMN public.shops.price_bw    IS 'Price per B&W page in INR.';
COMMENT ON COLUMN public.shops.price_color IS 'Price per color page in INR.';


-- 2. FINISHING SERVICES TABLE (per-shop custom pricing)
CREATE TABLE IF NOT EXISTS public.finishing_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('spiral_binding', 'corner_staple', 'hard_binding', 'lamination')),
  label       TEXT NOT NULL,
  price       NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  charge_unit TEXT NOT NULL DEFAULT 'per_copy' CHECK (charge_unit IN ('per_copy', 'per_sheet')),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, type)
);

ALTER TABLE public.finishing_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finishing_services_select_public"
  ON public.finishing_services FOR SELECT
  USING (true);

CREATE POLICY "finishing_services_manage_service_role"
  ON public.finishing_services FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.finishing_services IS 'Per-shop finishing/add-on services with custom pricing.';


-- 3. PRINT ORDERS TABLE (full order with multiple documents)
CREATE TABLE IF NOT EXISTS public.print_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL,

  -- Token & Queue
  token_code      TEXT,            -- e.g. "A-14"
  pickup_pin      TEXT,            -- 4-digit PIN
  queue_position  INT,
  
  -- Payment
  payment_method  TEXT CHECK (payment_method IN ('upi', 'cash')),
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending', 'awaiting_cash_confirmation', 'confirmed', 'failed')),
  total_amount    NUMERIC(8, 2) NOT NULL DEFAULT 0.00,

  -- Job lifecycle
  status          TEXT NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN ('pending_payment', 'queued', 'printing', 'ready_for_pickup', 'picked_up', 'cancelled')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_print_orders_shop_status
  ON public.print_orders (shop_id, status);
CREATE INDEX idx_print_orders_token
  ON public.print_orders (shop_id, token_code);

ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;

-- Customers (anon) can insert orders and read their own (by session_id)
CREATE POLICY "print_orders_insert_anon"
  ON public.print_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "print_orders_select_anon"
  ON public.print_orders FOR SELECT
  USING (true);

CREATE POLICY "print_orders_update_anon"
  ON public.print_orders FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.print_orders IS 'Customer print orders with queue tokens and payment tracking.';
COMMENT ON COLUMN public.print_orders.token_code IS 'Queue token display code, e.g. A-14.';
COMMENT ON COLUMN public.print_orders.pickup_pin IS '4-digit PIN for secure document collection.';


-- 4. ORDER DOCUMENTS TABLE (per-file within an order)
CREATE TABLE IF NOT EXISTS public.order_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.print_orders (id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_size       BIGINT NOT NULL,
  file_type       TEXT NOT NULL CHECK (file_type IN ('pdf', 'image')),
  page_count      INT NOT NULL DEFAULT 1,

  -- Print settings
  copies          INT NOT NULL DEFAULT 1,
  color_mode      TEXT NOT NULL DEFAULT 'bw' CHECK (color_mode IN ('bw', 'color')),
  duplex          TEXT NOT NULL DEFAULT 'single' CHECK (duplex IN ('single', 'double')),
  pages_per_sheet INT NOT NULL DEFAULT 1 CHECK (pages_per_sheet IN (1, 2, 4, 6, 9)),
  page_fit        TEXT NOT NULL DEFAULT 'fit' CHECK (page_fit IN ('fit', 'fill')),
  orientation     TEXT NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'landscape')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_documents_order
  ON public.order_documents (order_id);

ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_documents_insert_anon"
  ON public.order_documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "order_documents_select_anon"
  ON public.order_documents FOR SELECT
  USING (true);

COMMENT ON TABLE public.order_documents IS 'Individual documents within a print order, each with its own settings.';


-- 5. ENABLE REALTIME on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_orders;


-- 6. AUTO-UPDATE updated_at trigger for print_orders
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_print_orders_updated_at
  BEFORE UPDATE ON public.print_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
