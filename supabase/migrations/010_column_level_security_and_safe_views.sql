-- ============================================================
-- Migration: 010_column_level_security_and_safe_views.sql
-- Purpose:
--   1. Enforce Column-Level Security (CLS) on public.shops
--      Strictly revoke SELECT access to password_hash from anon and authenticated roles
--   2. Grant SELECT(password_hash) strictly to service_role (backend route handlers)
--   3. Create public.public_shops view for customer/storefront lookups
-- ============================================================

-- 1. COLUMN-LEVEL ACCESS RESTRICTION ON SENSITIVE COLUMNS
-- Revoke direct selection of password_hash from public roles
REVOKE SELECT (password_hash) ON public.shops FROM anon, authenticated;
GRANT SELECT (password_hash) ON public.shops TO service_role;

-- 2. CREATE A SECURE PUBLIC VIEW FOR STOREFRONTS AND MAP BROWSING
-- This view omits sensitive owner credentials completely
CREATE OR REPLACE VIEW public.public_shops AS
  SELECT 
    id,
    name,
    slug,
    upi_vpa,
    latitude,
    longitude,
    address,
    city,
    state,
    pincode,
    status,
    created_at
  FROM public.shops
  WHERE status = 'active';

-- Grant access on public view to anon and authenticated users
GRANT SELECT ON public.public_shops TO anon, authenticated, service_role;

COMMENT ON VIEW public.public_shops IS 'Public storefront view for customers and search. Contains zero sensitive owner or authentication data.';
