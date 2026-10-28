-- ============================================================
-- Migration: 019_permanent_purge_all_fees_and_tokens.sql
-- Purpose:
--   1. Permanently drop obsolete monetization tables (platform_settings, token_transactions)
--   2. Drop legacy fee and token columns from shops, print_events, and analytics tables
--   3. Drop all token-related RPCs (reserve_shop_token, refund_shop_token, credit_shop_tokens, deduct_shop_token)
--   4. Redefine reconcile_daily_shop_analytics without fee or GST columns
-- ============================================================

-- 1. Drop obsolete tables
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.token_transactions CASCADE;

-- 2. Drop obsolete RPCs
DROP FUNCTION IF EXISTS public.reserve_shop_token(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.refund_shop_token(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_shop_tokens(UUID, INT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.deduct_shop_token(UUID, TEXT) CASCADE;

-- 3. Drop obsolete fee and token columns from shops table
ALTER TABLE public.shops
  DROP COLUMN IF EXISTS platform_fee,
  DROP COLUMN IF EXISTS gst_percentage,
  DROP COLUMN IF EXISTS gst_amount,
  DROP COLUMN IF EXISTS total_charge,
  DROP COLUMN IF EXISTS token_balance,
  DROP COLUMN IF EXISTS tokens_used;

-- 4. Drop fee_amount from print_events
ALTER TABLE public.print_events
  DROP COLUMN IF EXISTS fee_amount;

-- 5. Drop fee and tax columns from analytics tables
ALTER TABLE public.shop_daily_analytics
  DROP COLUMN IF EXISTS platform_fees,
  DROP COLUMN IF EXISTS gst_amount;

ALTER TABLE public.platform_daily_analytics
  DROP COLUMN IF EXISTS total_platform_fees_inr,
  DROP COLUMN IF EXISTS total_gst_inr;

-- 6. Redefine reconcile_daily_shop_analytics to be 100% free (Net Earnings = Gross Revenue)
CREATE OR REPLACE FUNCTION public.reconcile_daily_shop_analytics(p_cutoff TIMESTAMPTZ DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := COALESCE(p_cutoff, now());
  v_orders_synced INT := 0;
  v_events_synced INT := 0;
BEGIN
  IF auth.role() NOT IN ('service_role', 'platform_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_role');
  END IF;

  -- 1. Reconcile confirmed print_orders into shop_daily_analytics
  INSERT INTO public.shop_daily_analytics (
    shop_id, analytics_date, total_orders, total_jobs,
    gross_revenue, upi_revenue, cash_revenue,
    net_earnings, updated_at
  )
  SELECT
    o.shop_id,
    DATE(o.created_at) AS analytics_date,
    COUNT(o.id) AS total_orders,
    COUNT(o.id) AS total_jobs,
    COALESCE(SUM(o.total_amount), 0.00) AS gross_revenue,
    COALESCE(SUM(CASE WHEN o.payment_method = 'upi' THEN o.total_amount ELSE 0 END), 0.00) AS upi_revenue,
    COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total_amount ELSE 0 END), 0.00) AS cash_revenue,
    COALESCE(SUM(o.total_amount), 0.00) AS net_earnings,
    now()
  FROM public.print_orders o
  WHERE o.created_at <= v_cutoff
    AND o.payment_status = 'confirmed'
  GROUP BY o.shop_id, DATE(o.created_at)
  ON CONFLICT (shop_id, analytics_date) DO UPDATE SET
    total_orders  = EXCLUDED.total_orders,
    total_jobs    = GREATEST(public.shop_daily_analytics.total_jobs, EXCLUDED.total_jobs),
    gross_revenue = EXCLUDED.gross_revenue,
    upi_revenue   = EXCLUDED.upi_revenue,
    cash_revenue  = EXCLUDED.cash_revenue,
    net_earnings  = EXCLUDED.net_earnings,
    updated_at    = now();

  GET DIAGNOSTICS v_orders_synced = ROW_COUNT;

  -- 2. Reconcile print_events for physical prints count
  INSERT INTO public.shop_daily_analytics (
    shop_id, analytics_date, total_jobs, updated_at
  )
  SELECT
    e.shop_id,
    DATE(e.created_at) AS analytics_date,
    COUNT(e.id) AS total_jobs,
    now()
  FROM public.print_events e
  WHERE e.created_at <= v_cutoff
  GROUP BY e.shop_id, DATE(e.created_at)
  ON CONFLICT (shop_id, analytics_date) DO UPDATE SET
    total_jobs    = GREATEST(public.shop_daily_analytics.total_jobs, EXCLUDED.total_jobs),
    updated_at    = now();

  GET DIAGNOSTICS v_events_synced = ROW_COUNT;

  -- 3. Reconcile platform network totals
  INSERT INTO public.platform_daily_analytics (
    analytics_date, active_shops_count, total_orders, total_jobs,
    total_volume_inr, updated_at
  )
  SELECT
    analytics_date,
    COUNT(DISTINCT shop_id) AS active_shops_count,
    SUM(total_orders) AS total_orders,
    SUM(total_jobs) AS total_jobs,
    SUM(gross_revenue) AS total_volume_inr,
    now()
  FROM public.shop_daily_analytics
  WHERE analytics_date <= DATE(v_cutoff)
  GROUP BY analytics_date
  ON CONFLICT (analytics_date) DO UPDATE SET
    active_shops_count      = EXCLUDED.active_shops_count,
    total_orders            = EXCLUDED.total_orders,
    total_jobs              = EXCLUDED.total_jobs,
    total_volume_inr        = EXCLUDED.total_volume_inr,
    updated_at              = now();

  RETURN jsonb_build_object(
    'success', true,
    'orders_synced', v_orders_synced,
    'events_synced', v_events_synced,
    'cutoff', v_cutoff
  );
END;
$$;
