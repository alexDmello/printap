-- ============================================================
-- Migration: Add slug to shops for subdomain routing
-- Target Domain: *.mellod.in
-- ============================================================

-- 1. Add slug column to public.shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Create index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_slug ON public.shops (slug);

-- 3. Auto-populate slug for existing shops from name
UPDATE public.shops
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
WHERE slug IS NULL;

-- 4. Fallback for any records where slug is empty or duplicate
UPDATE public.shops
SET slug = 'shop-' || substr(id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

-- 5. Add comment
COMMENT ON COLUMN public.shops.slug IS 'Unique URL-safe slug for subdomain routing (e.g. {slug}.mellod.in).';
