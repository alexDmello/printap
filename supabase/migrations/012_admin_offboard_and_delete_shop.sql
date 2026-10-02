-- ============================================================
-- Migration: 012_admin_offboard_and_delete_shop.sql
-- Purpose:
--   Complete offboarding and deletion of a shop:
--   1. Deletes all print events, print orders, and daily analytics
--   2. Deletes all verification OTPs for the owner
--   3. Purges the owner from auth.users (wiping Google OAuth records,
--      sessions, and identities as if they never onboarded)
--   4. Deletes the shop from public.shops and immediately frees the subdomain
--
-- How to apply:
--   Copy and run this in your Supabase SQL Editor:
--   (Dashboard -> SQL Editor -> New Query -> Run)
-- ============================================================

-- 1. STORED PROCEDURE FOR COMPLETE SHOP OFFBOARDING
CREATE OR REPLACE FUNCTION public.admin_delete_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner_email TEXT;
  v_shop_name TEXT;
  v_slug TEXT;
  v_auth_users_deleted INT := 0;
BEGIN
  -- 1. Fetch shop details before deletion
  SELECT owner_email, name, slug 
  INTO v_owner_email, v_shop_name, v_slug
  FROM public.shops
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shop not found');
  END IF;

  -- 2. Clean up associated print jobs and analytics
  DELETE FROM public.print_events WHERE shop_id = p_shop_id;
  DELETE FROM public.print_orders WHERE shop_id = p_shop_id;
  DELETE FROM public.shop_daily_analytics WHERE shop_id = p_shop_id;
  
  -- 3. Delete email OTPs associated with the owner
  IF v_owner_email IS NOT NULL AND trim(v_owner_email) <> '' THEN
    DELETE FROM public.email_otps WHERE lower(email) = lower(trim(v_owner_email));
    
    -- 4. Delete the user from auth.users (Google OAuth account, sessions, identities)
    -- This completely purges their account as if they never signed in / onboarded
    DELETE FROM auth.users WHERE lower(email) = lower(trim(v_owner_email));
    GET DIAGNOSTICS v_auth_users_deleted = ROW_COUNT;
  END IF;

  -- 5. Delete the shop row from public.shops
  DELETE FROM public.shops WHERE id = p_shop_id;

  RETURN jsonb_build_object(
    'success', true, 
    'deleted_shop_id', p_shop_id,
    'shop_name', v_shop_name,
    'slug', v_slug,
    'owner_email', v_owner_email,
    'auth_users_deleted', v_auth_users_deleted
  );
END;
$$;

-- Grant execution to all roles (anon, authenticated, service_role)
GRANT EXECUTE ON FUNCTION public.admin_delete_shop(UUID) TO anon, authenticated, service_role;

-- 2. ALLOW DELETE POLICY ON SHOPS
DROP POLICY IF EXISTS "shops_delete_service_role" ON public.shops;
DROP POLICY IF EXISTS "shops_delete_all" ON public.shops;
CREATE POLICY "shops_delete_all"
  ON public.shops FOR DELETE
  USING (true);

COMMENT ON FUNCTION public.admin_delete_shop IS 'Permanently deletes a shop and all associated Google OAuth credentials, orders, and OTPs as if they never onboarded.';
