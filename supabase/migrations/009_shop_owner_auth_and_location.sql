-- ============================================================
-- Migration: 009_shop_owner_auth_and_location.sql
-- Purpose: 
--   1. Add Owner Authentication (Email, Password Hash, Phone, Verification) to public.shops
--   2. Add Store Geolocation (Latitude, Longitude, Address, City, State, Pincode) to public.shops
--   3. Create public.email_otps table for Resend-powered 6-digit OTP verification
--   4. Enforce strict Row Level Security (RLS) on sensitive auth tokens
-- ============================================================

-- 1. ADD OWNER AUTH & LOCATION COLUMNS TO PUBLIC.SHOPS
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS owner_name      TEXT,
  ADD COLUMN IF NOT EXISTS owner_email     TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone     TEXT,
  ADD COLUMN IF NOT EXISTS password_hash   TEXT,
  ADD COLUMN IF NOT EXISTS email_verified  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude        NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude       NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS city            TEXT,
  ADD COLUMN IF NOT EXISTS state           TEXT,
  ADD COLUMN IF NOT EXISTS pincode         TEXT;

-- 2. CREATE UNIQUE INDEX ON OWNER EMAIL (Case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_owner_email 
  ON public.shops (lower(owner_email)) 
  WHERE owner_email IS NOT NULL;

-- 2.1 ENFORCE VALID EMAIL FORMAT AT THE DATABASE LEVEL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_owner_email_format'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT check_owner_email_format 
      CHECK (owner_email IS NULL OR owner_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;

-- 3. CREATE SPATIAL/GEOLOCATION INDEX FOR FAST NEARBY SHOP LOOKUPS
CREATE INDEX IF NOT EXISTS idx_shops_location 
  ON public.shops (latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 4. CREATE EMAIL OTPS TABLE FOR SECURE RESEND EMAIL VERIFICATION
CREATE TABLE IF NOT EXISTS public.email_otps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  otp_hash      TEXT NOT NULL, -- SHA-256 hash of the 6-digit OTP code (never plaintext)
  purpose       TEXT NOT NULL CHECK (purpose IN ('onboarding', 'reset_password')),
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 5,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for rapid OTP lookup and rate-limiting sweeps
CREATE INDEX IF NOT EXISTS idx_email_otps_lookup 
  ON public.email_otps (email, purpose, consumed, expires_at);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- email_otps is strictly a server-side table (accessible ONLY by service_role)
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_otps_service_role_all" ON public.email_otps;
CREATE POLICY "email_otps_service_role_all"
  ON public.email_otps
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Prevent public anon clients from reading password hashes or sensitive owner details
-- Existing public read policies on shops should only be allowed for non-sensitive storefront columns
COMMENT ON COLUMN public.shops.password_hash  IS 'Bcrypt-hashed owner password. NEVER exposed via public APIs.';
COMMENT ON COLUMN public.shops.owner_email    IS 'Unique login email of the shop owner.';
COMMENT ON COLUMN public.shops.latitude       IS 'Store location latitude selected on onboarding map.';
COMMENT ON COLUMN public.shops.longitude      IS 'Store location longitude selected on onboarding map.';
COMMENT ON COLUMN public.shops.address        IS 'Physical shop address or landmark.';
COMMENT ON TABLE public.email_otps            IS 'Stores SHA-256 hashed 6-digit OTPs for onboarding and password resets via Resend.';
