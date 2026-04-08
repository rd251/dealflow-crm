
ALTER TABLE public.selskap_dokumenter
  ADD COLUMN IF NOT EXISTS dealbuilder_dokument_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tittel text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS opprettet_dato timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kilde text DEFAULT 'manuell';

CREATE UNIQUE INDEX IF NOT EXISTS idx_selskap_dok_dealbuilder_id
  ON public.selskap_dokumenter (dealbuilder_dokument_id)
  WHERE dealbuilder_dokument_id IS NOT NULL;
