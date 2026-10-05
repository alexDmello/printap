-- ============================================================
-- Migration: 015_drop_insecure_token_policy.sql
-- Purpose:
--   1. Drop the insecure 'token_transactions_insert_anon' policy
--      that allowed arbitrary users to wipe shop tokens.
--   2. Ensure all token transactions are routed exclusively 
--      through the secure SECURITY DEFINER RPCs.
-- ============================================================

DROP POLICY IF EXISTS "token_transactions_insert_anon" ON public.token_transactions;

-- The service_role policies still exist, and the reserve_shop_token/refund_shop_token
-- RPCs run as SECURITY DEFINER (postgres user), bypassing RLS for safe server-side operations.
