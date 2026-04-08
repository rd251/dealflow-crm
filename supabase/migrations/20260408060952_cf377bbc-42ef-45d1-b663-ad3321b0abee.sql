
-- Add DealBuilder fields to salgsmuligheter
ALTER TABLE public.salgsmuligheter
  ADD COLUMN IF NOT EXISTS kontrakt_status text NOT NULL DEFAULT 'Ikke sendt',
  ADD COLUMN IF NOT EXISTS kontrakt_signert_dato timestamptz,
  ADD COLUMN IF NOT EXISTS dealbuilder_dokument_id text;
