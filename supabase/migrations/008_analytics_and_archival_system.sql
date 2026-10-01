-- ============================================================
-- Migration 008: Analytics & Monthly Archival Lifecycle System
-- Run in Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. SHOP DAILY ANALYTICS TABLE
-- Stores pre-aggregated daily summaries per shop.
-- Lightweight and fast; permanent store even after raw orders are purged.
CREATE TABLE IF NOT EXISTS public.shop_daily_analytics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  analytics_date      DATE NOT NULL,
  total_orders        INT NOT NULL DEFAULT 0,
  total_jobs          INT NOT NULL DEFAULT 0,
  bw_pages            INT NOT NULL DEFAULT 0,
  color_pages         INT NOT NULL DEFAULT 0,
  gross_revenue       NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  upi_revenue         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  cash_revenue        NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  platform_fees       NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  gst_amount          NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  net_earnings        NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, analytics_date)
);

CREATE INDEX IF NOT EXISTS idx_shop_daily_analytics_shop_date 
  ON public.shop_daily_analytics(shop_id, analytics_date DESC);

-- 2. PLATFORM DAILY ANALYTICS TABLE
-- Stores network-wide daily summaries for executive dashboard.
CREATE TABLE IF NOT EXISTS public.platform_daily_analytics (
  analytics_date           DATE PRIMARY KEY,
  active_shops_count       INT NOT NULL DEFAULT 0,
  total_orders             INT NOT NULL DEFAULT 0,
  total_jobs               INT NOT NULL DEFAULT 0,
  total_volume_inr         NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_platform_fees_inr  NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_gst_inr            NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ARCHIVE AUDIT LOG TABLE
-- Tracks local exports and purges conducted by the Electron Admin app.
CREATE TABLE IF NOT EXISTS public.archive_audit_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_identifier   TEXT NOT NULL,              -- e.g. "2026-09"
  cutoff_timestamp   TIMESTAMPTZ NOT NULL,
  orders_purged      INT NOT NULL DEFAULT 0,
  events_purged      INT NOT NULL DEFAULT 0,
  total_amount_inr   NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  exported_by        TEXT NOT NULL DEFAULT 'electron_admin',
  status             TEXT NOT NULL DEFAULT 'completed',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_audit_log_month
  ON public.archive_audit_log(month_identifier DESC);

-- 4. RLS POLICIES
ALTER TABLE public.shop_daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow select for public / anon
DROP POLICY IF EXISTS "shop_daily_analytics_select_all" ON public.shop_daily_analytics;
CREATE POLICY "shop_daily_analytics_select_all"
  ON public.shop_daily_analytics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "shop_daily_analytics_upsert_all" ON public.shop_daily_analytics;
CREATE POLICY "shop_daily_analytics_upsert_all"
  ON public.shop_daily_analytics FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "platform_daily_analytics_select_all" ON public.platform_daily_analytics;
CREATE POLICY "platform_daily_analytics_select_all"
  ON public.platform_daily_analytics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "platform_daily_analytics_upsert_all" ON public.platform_daily_analytics;
CREATE POLICY "platform_daily_analytics_upsert_all"
  ON public.platform_daily_analytics FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "archive_audit_log_all" ON public.archive_audit_log;
CREATE POLICY "archive_audit_log_all"
  ON public.archive_audit_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. RPC FUNCTION: SYNC AGGREGATE ANALYTICS
-- Pre-aggregates raw orders and events up to an optional cutoff into the daily tables.
CREATE OR REPLACE FUNCTION public.sync_aggregate_analytics(p_cutoff_timestamp TIMESTAMPTZ DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := COALESCE(p_cutoff_timestamp, now());
  v_orders_synced INT := 0;
  v_events_synced INT := 0;
BEGIN
  -- 1. Aggregate print_orders by shop and date
  INSERT INTO public.shop_daily_analytics (
    shop_id,
    analytics_date,
    total_orders,
    total_jobs,
    gross_revenue,
    upi_revenue,
    cash_revenue,
    platform_fees,
    gst_amount,
    net_earnings,
    updated_at
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

  -- 2. Aggregate direct print_events where no orders existed
  INSERT INTO public.shop_daily_analytics (
    shop_id,
    analytics_date,
    total_jobs,
    platform_fees,
    gst_amount,
    updated_at
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

  -- 3. Roll up into platform_daily_analytics
  INSERT INTO public.platform_daily_analytics (
    analytics_date,
    active_shops_count,
    total_orders,
    total_jobs,
    total_volume_inr,
    total_platform_fees_inr,
    total_gst_inr,
    updated_at
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

-- 6. RPC FUNCTION: PURGE ARCHIVED MONTH DATA
-- Purges old raw orders and events safely AFTER ensuring analytics are aggregated.
CREATE OR REPLACE FUNCTION public.purge_archived_month_data(
  p_cutoff_timestamp TIMESTAMPTZ,
  p_month_label TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders_purged INT := 0;
  v_events_purged INT := 0;
  v_total_amount NUMERIC(12, 2) := 0.00;
BEGIN
  -- 1. Ensure daily summaries are 100% computed prior to purge
  PERFORM public.sync_aggregate_analytics(p_cutoff_timestamp);

  -- 2. Calculate total amount about to be purged
  SELECT COALESCE(SUM(total_amount), 0.00), COUNT(*)
  INTO v_total_amount, v_orders_purged
  FROM public.print_orders
  WHERE created_at < p_cutoff_timestamp;

  -- 3. Count events
  SELECT COUNT(*)
  INTO v_events_purged
  FROM public.print_events
  WHERE created_at < p_cutoff_timestamp;

  -- 4. Purge raw print orders (cascade will purge order_documents)
  DELETE FROM public.print_orders
  WHERE created_at < p_cutoff_timestamp;

  -- 5. Purge raw print events
  DELETE FROM public.print_events
  WHERE created_at < p_cutoff_timestamp;

  -- 6. Record audit log
  INSERT INTO public.archive_audit_log (
    month_identifier,
    cutoff_timestamp,
    orders_purged,
    events_purged,
    total_amount_inr,
    exported_by,
    status
  ) VALUES (
    p_month_label,
    p_cutoff_timestamp,
    v_orders_purged,
    v_events_purged,
    v_total_amount,
    'electron_admin',
    'completed'
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
