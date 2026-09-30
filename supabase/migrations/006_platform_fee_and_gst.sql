-- ============================================================
-- Migration: Add platform fee & GST configuration
-- ============================================================

-- 1. Create global platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  platform_fee NUMERIC(6, 2) NOT NULL DEFAULT 0.82,
  gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  gst_amount NUMERIC(6, 2) NOT NULL DEFAULT 0.18,
  total_charge NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_all" ON public.platform_settings;
CREATE POLICY "platform_settings_select_all"
  ON public.platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "platform_settings_insert_all" ON public.platform_settings;
CREATE POLICY "platform_settings_insert_all"
  ON public.platform_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "platform_settings_update_all" ON public.platform_settings;
CREATE POLICY "platform_settings_update_all"
  ON public.platform_settings FOR UPDATE USING (true) WITH CHECK (true);

-- Insert initial default record
INSERT INTO public.platform_settings (id, platform_fee, gst_percentage, gst_amount, total_charge)
VALUES ('global', 0.82, 18.00, 0.18, 1.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Add platform fee & GST columns to shops table (for shop-level overrides or direct shop admin management)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(6, 2) DEFAULT 0.82,
  ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5, 2) DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(6, 2) DEFAULT 0.18,
  ADD COLUMN IF NOT EXISTS total_charge NUMERIC(6, 2) DEFAULT 1.00;

-- 3. Update existing shops with initial default values
UPDATE public.shops
SET
  platform_fee = COALESCE(platform_fee, 0.82),
  gst_percentage = COALESCE(gst_percentage, 18.00),
  gst_amount = COALESCE(gst_amount, 0.18),
  total_charge = COALESCE(total_charge, 1.00)
WHERE platform_fee IS NULL OR total_charge IS NULL;
