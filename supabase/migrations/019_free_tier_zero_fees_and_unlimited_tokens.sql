-- ============================================================
-- Migration: 019_free_tier_zero_fees_and_unlimited_tokens.sql
-- Purpose:
--   1. Transition platform to 100% Free, Ad-Supported tier
--   2. Set default platform_fee, gst_percentage, gst_amount, total_charge to 0.00
--   3. Upgrade existing shops to unlimited tokens (999999)
--   4. Update reserve_shop_token and refund_shop_token RPCs to always succeed without deducting
-- ============================================================

-- 1. Reset Global Platform Settings to Zero Fees
UPDATE public.platform_settings
SET
  platform_fee = 0.00,
  gst_percentage = 0.00,
  gst_amount = 0.00,
  total_charge = 0.00,
  updated_at = now()
WHERE id = 'global';

-- Ensure default column constraints on platform_settings
ALTER TABLE public.platform_settings
  ALTER COLUMN platform_fee SET DEFAULT 0.00,
  ALTER COLUMN gst_percentage SET DEFAULT 0.00,
  ALTER COLUMN gst_amount SET DEFAULT 0.00,
  ALTER COLUMN total_charge SET DEFAULT 0.00;

-- 2. Update Column Defaults on shops Table
ALTER TABLE public.shops
  ALTER COLUMN platform_fee SET DEFAULT 0.00,
  ALTER COLUMN gst_percentage SET DEFAULT 0.00,
  ALTER COLUMN gst_amount SET DEFAULT 0.00,
  ALTER COLUMN total_charge SET DEFAULT 0.00,
  ALTER COLUMN token_balance SET DEFAULT 999999;

-- 3. Reset all existing shops to 0 fees and unlimited token balance
UPDATE public.shops
SET
  platform_fee = 0.00,
  gst_percentage = 0.00,
  gst_amount = 0.00,
  total_charge = 0.00,
  token_balance = GREATEST(COALESCE(token_balance, 0), 999999);

-- 4. Overwrite reserve_shop_token RPC (Free Tier: Always Allow)
CREATE OR REPLACE FUNCTION public.reserve_shop_token(
  p_shop_id UUID,
  p_session_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- In 100% Free Tier, token deductions are bypassed.
  -- Returns success with unlimited balance so legacy clients never fail.
  RETURN jsonb_build_object(
    'success', true,
    'balance', 999999,
    'alert', false
  );
END;
$$;

-- 5. Overwrite refund_shop_token RPC (Free Tier: Always Succeed)
CREATE OR REPLACE FUNCTION public.refund_shop_token(
  p_shop_id UUID,
  p_session_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'balance', 999999
  );
END;
$$;
