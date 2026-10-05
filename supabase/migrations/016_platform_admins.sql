-- ============================================================
-- Migration: 016_platform_admins.sql
-- Purpose:
--   1. Create platform_admins table to strictly authorize
--      super-admin access for the Admin Desktop App.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_admins IS 'Authorizes specific auth.users as platform super-admins for the Desktop Agent.';

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Admins can view their own record to verify their admin status
CREATE POLICY "platform_admins_select_own"
  ON public.platform_admins FOR SELECT
  USING (auth.uid() = id);

-- Service role can do everything
CREATE POLICY "platform_admins_all_service_role"
  ON public.platform_admins FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
