-- Migration: Add printer_number column to printer_assignments
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)

ALTER TABLE IF EXISTS public.printer_assignments
  ADD COLUMN IF NOT EXISTS printer_number INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.printer_assignments.printer_number IS 'Numeric identifier for the printer used in token generation (e.g. 1, 2).';
