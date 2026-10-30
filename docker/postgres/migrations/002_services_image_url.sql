-- Add photo support for Kitchen and Deals catalogue items.
-- Safe to apply to an existing Docker PostgreSQL database.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text;
