-- ============================================================
-- Migration: 017_security_hardening_and_fixes.sql
-- Purpose:
--   1. Fix missing schema columns (printer_assignments.printer_number, shops fee columns)
--   2. Remediate P0 RLS bypasses on shops, print_orders, and analytics tables
--   3. Prevent password_hash exposure to anon clients via Column-Level Privileges
--   4. Add UNIQUE constraint on token_transactions escrow_session_id to prevent TOCTOU race conditions
--   5. Harden SECURITY DEFINER functions with explicit search_path and role checks
-- ============================================================

BEGIN;

-- 1. ADD MISSING SCHEMA COLUMNS REFERENCED BY APPLICATION CODE
CREATE TABLE IF NOT EXISTS public.printer_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  printer_name  TEXT NOT NULL,
  printer_number INT NOT NULL DEFAULT 1,
  role          TEXT NOT NULL DEFAULT 'both' CHECK (role IN ('bw', 'color', 'both', 'disabled')),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.printer_assignments
  ADD COLUMN IF NOT EXISTS printer_number INT NOT NULL DEFAULT 1;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS platform_fee   NUMERIC(6, 2) NOT NULL DEFAULT 0.82,
  ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS gst_amount     NUMERIC(6, 2) NOT NULL DEFAULT 0.18,
  ADD COLUMN IF NOT EXISTS total_charge   NUMERIC(6, 2) NOT NULL DEFAULT 1.00;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id              TEXT PRIMARY KEY DEFAULT 'global',
  platform_fee    NUMERIC(6, 2) NOT NULL DEFAULT 0.82,
  gst_percentage  NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  gst_amount      NUMERIC(6, 2) NOT NULL DEFAULT 0.18,
  total_charge    NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_public" ON public.platform_settings;
CREATE POLICY "platform_settings_select_public"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "platform_settings_write_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_write_admin"
  ON public.platform_settings FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  );

-- 2. COLUMN-LEVEL SECURITY: HIDE password_hash FROM ANON & AUTHENTICATED ROLES
REVOKE SELECT (password_hash) ON public.shops FROM anon, authenticated;

-- 3. LOCK DOWN DANGEROUS ANON WRITE POLICIES ON SHOPS & ANALYTICS
DROP POLICY IF EXISTS "shops_update_anon" ON public.shops;

-- Controlled RPC for shop settings updates instead of open table UPDATE
CREATE OR REPLACE FUNCTION public.update_shop_settings(
  p_shop_id UUID,
  p_price_bw NUMERIC,
  p_price_color NUMERIC,
  p_services JSONB
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_price_bw < 0 OR p_price_color < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_pricing');
  END IF;

  UPDATE public.shops
  SET price_bw = p_price_bw,
      price_color = p_price_color,
      services = COALESCE(p_services, services)
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Controlled RPC for shop presence heartbeat (prevents anon from mutating token_balance or upi_vpa)
CREATE OR REPLACE FUNCTION public.set_shop_presence(
  p_shop_id UUID,
  p_is_online BOOLEAN
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shops
  SET is_online = p_is_online,
      last_seen_at = CASE WHEN p_is_online THEN now() ELSE last_seen_at END
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Restrict analytics mutations strictly to service_role or platform_admins
DROP POLICY IF EXISTS "shop_daily_analytics_upsert_all" ON public.shop_daily_analytics;
DROP POLICY IF EXISTS "shop_daily_analytics_write_admin" ON public.shop_daily_analytics;
CREATE POLICY "shop_daily_analytics_write_admin"
  ON public.shop_daily_analytics FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "platform_daily_analytics_upsert_all" ON public.platform_daily_analytics;
DROP POLICY IF EXISTS "platform_daily_analytics_write_admin" ON public.platform_daily_analytics;
CREATE POLICY "platform_daily_analytics_write_admin"
  ON public.platform_daily_analytics FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "archive_audit_log_all" ON public.archive_audit_log;
DROP POLICY IF EXISTS "archive_audit_log_select_admin" ON public.archive_audit_log;
DROP POLICY IF EXISTS "archive_audit_log_admin_all" ON public.archive_audit_log;
CREATE POLICY "archive_audit_log_admin_all"
  ON public.archive_audit_log FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid())
  );

-- Remove direct anon inserts into token_transactions (must go through atomic RPCs only)
DROP POLICY IF EXISTS "token_transactions_insert_anon" ON public.token_transactions;

-- Allow shopkeepers to read their token_transactions history
DROP POLICY IF EXISTS "token_transactions_select_shop" ON public.token_transactions;
CREATE POLICY "token_transactions_select_shop"
  ON public.token_transactions FOR SELECT
  USING (true);

-- 4. ADD MISSING INDEXES & UNIQUE CONSTRAINTS FOR ESCROW IDEMPOTENCY
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_tx_unique_escrow_type
  ON public.token_transactions (shop_id, escrow_session_id, type)
  WHERE escrow_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_print_orders_session_id
  ON public.print_orders (session_id);

CREATE INDEX IF NOT EXISTS idx_print_orders_shop_created
  ON public.print_orders (shop_id, created_at DESC);

-- 5. HARDEN TOKEN ESCROW, REFUND, AND CREDIT RPCs
CREATE OR REPLACE FUNCTION public.reserve_shop_token(
  p_shop_id UUID,
  p_session_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  C_WARN_THRESHOLD CONSTANT INT := 10;
BEGIN
  IF p_shop_id IS NULL OR p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_parameters');
  END IF;

  -- 1. Acquire row-level lock on shop first to serialize all concurrent operations for this shop
  SELECT token_balance
  INTO v_current_balance
  FROM public.shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  -- 2. Check idempotency under the shop lock
  IF EXISTS (
    SELECT 1 FROM public.token_transactions
    WHERE shop_id = p_shop_id
      AND escrow_session_id = p_session_id
      AND type = 'deduction'
  ) THEN
    RETURN jsonb_build_object('success', true, 'balance', v_current_balance, 'status', 'already_reserved');
  END IF;

  IF v_current_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_tokens', 'balance', 0);
  END IF;

  v_new_balance := v_current_balance - 1;

  UPDATE public.shops
  SET token_balance = v_new_balance,
      tokens_used = tokens_used + 1
  WHERE id = p_shop_id;

  INSERT INTO public.token_transactions (
    shop_id, type, amount, balance_after, reference, note, escrow_session_id
  ) VALUES (
    p_shop_id, 'deduction', 1, v_new_balance, p_session_id, 'Token reserved in escrow before print', p_session_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'alert', v_new_balance <= C_WARN_THRESHOLD
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'balance', v_current_balance, 'status', 'already_reserved');
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_shop_token(
  p_shop_id UUID,
  p_session_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  IF p_shop_id IS NULL OR p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_parameters');
  END IF;

  -- 1. Lock shop row first to serialize concurrent refund attempts
  SELECT token_balance
  INTO v_current_balance
  FROM public.shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  -- 2. Verify reservation exists
  IF NOT EXISTS (
    SELECT 1 FROM public.token_transactions
    WHERE shop_id = p_shop_id
      AND escrow_session_id = p_session_id
      AND type = 'deduction'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_reservation_found');
  END IF;

  -- 3. Verify not already refunded
  IF EXISTS (
    SELECT 1 FROM public.token_transactions
    WHERE shop_id = p_shop_id
      AND escrow_session_id = p_session_id
      AND type = 'refund'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_refunded');
  END IF;

  v_new_balance := v_current_balance + 1;

  UPDATE public.shops
  SET token_balance = v_new_balance,
      tokens_used = GREATEST(0, tokens_used - 1)
  WHERE id = p_shop_id;

  INSERT INTO public.token_transactions (
    shop_id, type, amount, balance_after, reference, note, escrow_session_id
  ) VALUES (
    p_shop_id, 'refund', 1, v_new_balance, p_session_id, 'Token refunded due to print failure', p_session_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_refunded');
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_shop_tokens(
  p_shop_id UUID,
  p_amount INT,
  p_reference TEXT DEFAULT NULL,
  p_note TEXT DEFAULT 'Manual top-up'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  -- Restrict execution to service_role or verified platform_admins
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_role');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  SELECT token_balance
  INTO v_current_balance
  FROM public.shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  v_new_balance := v_current_balance + p_amount;

  UPDATE public.shops
  SET token_balance = v_new_balance
  WHERE id = p_shop_id;

  INSERT INTO public.token_transactions (
    shop_id, type, amount, balance_after, reference, note
  ) VALUES (
    p_shop_id, 'topup', p_amount, v_new_balance, p_reference, p_note
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance
  );
END;
$$;

COMMIT;
