-- ============================================================
-- Migration: Add custom services & dynamic pricing to shops
-- ============================================================

-- 1. Ensure price_bw and price_color exist with defaults
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS price_bw NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS price_color NUMERIC(6, 2) NOT NULL DEFAULT 10.00;

-- 2. Add services JSONB column to shops table to store custom services & toggles
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.shops.services IS 'Array of configured services, prices, units, and active toggles for this shop.';

-- 3. Update RLS policy to allow shopkeeper updates via anon or authenticated
DROP POLICY IF EXISTS "shops_update_anon" ON public.shops;
CREATE POLICY "shops_update_anon"
  ON public.shops FOR UPDATE
  USING (true)
  WITH CHECK (true);
