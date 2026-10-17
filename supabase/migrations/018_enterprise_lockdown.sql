-- ============================================================
-- Migration: 018_enterprise_lockdown.sql
-- Purpose:
--   1. Drop legacy deduct_shop_token (superseded by reserve_shop_token)
--   2. Harden cleanup_stale_online_shops with explicit search_path
--   3. Restrict sync_aggregate_analytics and purge_archived_month_data
--      strictly to service_role or platform_admins
--   4. Provide controlled RPC for pruning removed printer_assignments
-- ============================================================

BEGIN;

-- 1. Drop legacy deduct_shop_token (superseded by reserve_shop_token)
DROP FUNCTION IF EXISTS public.deduct_shop_token(UUID, TEXT);

-- 2. Harden cleanup_stale_online_shops
CREATE OR REPLACE FUNCTION public.cleanup_stale_online_shops(stale_seconds INT DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.shops
  SET is_online = false
  WHERE is_online = true
    AND last_seen_at < (now() - (stale_seconds || ' seconds')::interval);
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

-- 3. Restrict sync_aggregate_analytics to service_role or platform_admins
CREATE OR REPLACE FUNCTION public.sync_aggregate_analytics(p_cutoff_timestamp TIMESTAMPTZ DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := COALESCE(p_cutoff_timestamp, now());
  v_orders_synced INT := 0;
  v_events_synced INT := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_role');
  END IF;

  INSERT INTO public.shop_daily_analytics (
    shop_id, analytics_date, total_orders, total_jobs,
    gross_revenue, upi_revenue, cash_revenue,
    platform_fees, gst_amount, net_earnings, updated_at
  )
  SELECT
    o.shop_id,
    DATE(o.created_at) AS analytics_date,
    COUNT(o.id) AS total_orders,
    COUNT(o.id) AS total_jobs,
    COALESCE(SUM(o.total_amount), 0.00) AS gross_revenue,
    COALESCE(SUM(CASE WHEN o.payment_method = 'upi' THEN o.total_amount ELSE 0 END), 0.00) AS upi_revenue,
    COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total_amount ELSE 0 END), 0.00) AS cash_revenue,
    COALESCE(SUM(COALESCE(s.platform_fee, 0.82)), 0.00) AS platform_fees,
    COALESCE(SUM(COALESCE(s.gst_amount, 0.18)), 0.00) AS gst_amount,
    COALESCE(SUM(o.total_amount) - SUM(COALESCE(s.total_charge, 1.00)), 0.00) AS net_earnings,
    now()
  FROM public.print_orders o
  LEFT JOIN public.shops s ON s.id = o.shop_id
  WHERE o.created_at <= v_cutoff
    AND o.payment_status = 'confirmed'
  GROUP BY o.shop_id, DATE(o.created_at)
  ON CONFLICT (shop_id, analytics_date) DO UPDATE SET
    total_orders  = EXCLUDED.total_orders,
    total_jobs    = GREATEST(public.shop_daily_analytics.total_jobs, EXCLUDED.total_jobs),
    gross_revenue = EXCLUDED.gross_revenue,
    upi_revenue   = EXCLUDED.upi_revenue,
    cash_revenue  = EXCLUDED.cash_revenue,
    platform_fees = EXCLUDED.platform_fees,
    gst_amount    = EXCLUDED.gst_amount,
    net_earnings  = EXCLUDED.net_earnings,
    updated_at    = now();

  GET DIAGNOSTICS v_orders_synced = ROW_COUNT;

  INSERT INTO public.shop_daily_analytics (
    shop_id, analytics_date, total_jobs, platform_fees, gst_amount, updated_at
  )
  SELECT
    e.shop_id,
    DATE(e.created_at) AS analytics_date,
    COUNT(e.id) AS total_jobs,
    COALESCE(SUM(e.fee_amount * 0.82), 0.00) AS platform_fees,
    COALESCE(SUM(e.fee_amount * 0.18), 0.00) AS gst_amount,
    now()
  FROM public.print_events e
  WHERE e.created_at <= v_cutoff
  GROUP BY e.shop_id, DATE(e.created_at)
  ON CONFLICT (shop_id, analytics_date) DO UPDATE SET
    total_jobs    = GREATEST(public.shop_daily_analytics.total_jobs, EXCLUDED.total_jobs),
    platform_fees = GREATEST(public.shop_daily_analytics.platform_fees, EXCLUDED.platform_fees),
    gst_amount    = GREATEST(public.shop_daily_analytics.gst_amount, EXCLUDED.gst_amount),
    updated_at    = now();

  GET DIAGNOSTICS v_events_synced = ROW_COUNT;

  INSERT INTO public.platform_daily_analytics (
    analytics_date, active_shops_count, total_orders, total_jobs,
    total_volume_inr, total_platform_fees_inr, total_gst_inr, updated_at
  )
  SELECT
    analytics_date,
    COUNT(DISTINCT shop_id) AS active_shops_count,
    SUM(total_orders) AS total_orders,
    SUM(total_jobs) AS total_jobs,
    SUM(gross_revenue) AS total_volume_inr,
    SUM(platform_fees) AS total_platform_fees_inr,
    SUM(gst_amount) AS total_gst_inr,
    now()
  FROM public.shop_daily_analytics
  WHERE analytics_date <= DATE(v_cutoff)
  GROUP BY analytics_date
  ON CONFLICT (analytics_date) DO UPDATE SET
    active_shops_count      = EXCLUDED.active_shops_count,
    total_orders            = EXCLUDED.total_orders,
    total_jobs              = EXCLUDED.total_jobs,
    total_volume_inr        = EXCLUDED.total_volume_inr,
    total_platform_fees_inr = EXCLUDED.total_platform_fees_inr,
    total_gst_inr           = EXCLUDED.total_gst_inr,
    updated_at              = now();

  RETURN jsonb_build_object(
    'success', true,
    'orders_synced', v_orders_synced,
    'events_synced', v_events_synced,
    'cutoff', v_cutoff
  );
END;
$$;

-- 4. Restrict purge_archived_month_data strictly to service_role or platform_admins
CREATE OR REPLACE FUNCTION public.purge_archived_month_data(
  p_cutoff_timestamp TIMESTAMPTZ,
  p_month_label TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders_purged INT := 0;
  v_events_purged INT := 0;
  v_total_amount NUMERIC(12, 2) := 0.00;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_role');
  END IF;

  PERFORM public.sync_aggregate_analytics(p_cutoff_timestamp);

  SELECT COALESCE(SUM(total_amount), 0.00), COUNT(*)
  INTO v_total_amount, v_orders_purged
  FROM public.print_orders
  WHERE created_at < p_cutoff_timestamp;

  SELECT COUNT(*)
  INTO v_events_purged
  FROM public.print_events
  WHERE created_at < p_cutoff_timestamp;

  DELETE FROM public.print_orders
  WHERE created_at < p_cutoff_timestamp;

  DELETE FROM public.print_events
  WHERE created_at < p_cutoff_timestamp;

  INSERT INTO public.archive_audit_log (
    month_identifier, cutoff_timestamp, orders_purged, events_purged,
    total_amount_inr, exported_by, status
  ) VALUES (
    p_month_label, p_cutoff_timestamp, v_orders_purged, v_events_purged,
    v_total_amount, 'electron_admin', 'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'month', p_month_label,
    'cutoff', p_cutoff_timestamp,
    'orders_purged', v_orders_purged,
    'events_purged', v_events_purged,
    'total_amount_purged', v_total_amount
  );
END;
$$;

COMMIT;
