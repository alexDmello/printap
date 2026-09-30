-- ============================================================
-- Migration: Add online presence tracking to shops
-- ============================================================

-- 1. Add online presence tracking columns to shops table
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

-- 2. Index for quick online status lookups
CREATE INDEX IF NOT EXISTS idx_shops_is_online ON public.shops (is_online);

-- 3. Add last_seen_at for stale presence cleanup
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 4. Enable Supabase Realtime for shops table so customers get instant status changes
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Helper function for sweeping stale online shops (called by cron or edge function)
CREATE OR REPLACE FUNCTION public.cleanup_stale_online_shops(stale_seconds INT DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6. Comments
COMMENT ON COLUMN public.shops.is_online IS 'true when the desktop agent is running and owner has toggled online.';
COMMENT ON COLUMN public.shops.last_seen_at IS 'Last heartbeat timestamp from the desktop agent, used for stale cleanup.';
COMMENT ON FUNCTION public.cleanup_stale_online_shops IS 'Sweeps shops marked is_online=true whose last_seen_at heartbeat is older than stale_seconds.';
