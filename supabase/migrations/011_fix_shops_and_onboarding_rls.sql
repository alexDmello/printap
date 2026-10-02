-- ============================================================
-- Migration: 011_fix_shops_and_onboarding_rls.sql
-- Purpose:
--   1. Allow shop registration (INSERT on public.shops) during onboarding
--   2. Allow server/onboarding flow to manage email_otps for verification
--   3. Compatible with both anon key (local dev) and service_role (production)
--
-- How to apply:
--   Copy and run this in your Supabase SQL Editor:
--   (Dashboard -> SQL Editor -> New Query -> Run)
-- ============================================================

-- 1. SHOPS TABLE INSERT & UPDATE POLICIES
-- Drop restrictive service_role-only insert policy
DROP POLICY IF EXISTS "shops_insert_service_role" ON public.shops;
DROP POLICY IF EXISTS "shops_insert_public" ON public.shops;
DROP POLICY IF EXISTS "shops_insert_all" ON public.shops;

-- Allow shop creation during onboarding
CREATE POLICY "shops_insert_all"
  ON public.shops FOR INSERT
  WITH CHECK (true);

-- Ensure public can read shop storefront info
DROP POLICY IF EXISTS "shops_select_public" ON public.shops;
CREATE POLICY "shops_select_public"
  ON public.shops FOR SELECT
  USING (true);

-- Ensure shops can be updated (services, pricing, status, location)
DROP POLICY IF EXISTS "shops_update_anon" ON public.shops;
DROP POLICY IF EXISTS "shops_update_all" ON public.shops;
CREATE POLICY "shops_update_all"
  ON public.shops FOR UPDATE
  USING (true)
  WITH CHECK (true);


-- 2. EMAIL OTPS POLICIES
-- Allow serverless handlers using anon or service key to manage verification OTPs
DROP POLICY IF EXISTS "email_otps_service_role_all" ON public.email_otps;
DROP POLICY IF EXISTS "email_otps_all" ON public.email_otps;

CREATE POLICY "email_otps_all"
  ON public.email_otps
  FOR ALL
  USING (true)
  WITH CHECK (true);
