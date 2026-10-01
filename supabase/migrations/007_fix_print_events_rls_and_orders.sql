-- ============================================================
-- Migration: Fix print_events RLS and ensure print_orders access
-- Run in Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. FIX PRINT_EVENTS RLS POLICY
-- The previous policy required auth.role() = 'service_role', which blocked
-- the Shop Admin (web & desktop) and Platform Admin using the anon API key
-- from reading print events, resulting in 0 prints and ₹0 revenue.
DROP POLICY IF EXISTS "print_events_select_service_role" ON public.print_events;
DROP POLICY IF EXISTS "print_events_select_all" ON public.print_events;

CREATE POLICY "print_events_select_all"
  ON public.print_events FOR SELECT
  USING (true);

-- Ensure anon insert is preserved
DROP POLICY IF EXISTS "print_events_insert_anon" ON public.print_events;
CREATE POLICY "print_events_insert_anon"
  ON public.print_events FOR INSERT
  WITH CHECK (true);

-- 2. ENSURE PRINT_ORDERS POLICIES
-- Allow anon read/write on print_orders for customer ordering and shop admin tracking
DROP POLICY IF EXISTS "print_orders_select_anon" ON public.print_orders;
CREATE POLICY "print_orders_select_anon"
  ON public.print_orders FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "print_orders_insert_anon" ON public.print_orders;
CREATE POLICY "print_orders_insert_anon"
  ON public.print_orders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "print_orders_update_anon" ON public.print_orders;
CREATE POLICY "print_orders_update_anon"
  ON public.print_orders FOR UPDATE
  USING (true)
  WITH CHECK (true);
