
ALTER TABLE public.aktiviteter
  ADD COLUMN IF NOT EXISTS tittel text DEFAULT '',
  ADD COLUMN IF NOT EXISTS start_tid timestamp with time zone DEFAULT null,
  ADD COLUMN IF NOT EXISTS slutt_tid timestamp with time zone DEFAULT null,
  ADD COLUMN IF NOT EXISTS deltakere uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ekstern_id text DEFAULT null,
  ADD COLUMN IF NOT EXISTS ekstern_provider text DEFAULT null,
  ADD COLUMN IF NOT EXISTS aktivitet_kilde text DEFAULT 'manuell';
