ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pinned_notat text,
  ADD COLUMN IF NOT EXISTS pinned_notat_av text,
  ADD COLUMN IF NOT EXISTS pinned_notat_dato timestamp with time zone;

ALTER TABLE public.salgsmuligheter
  ADD COLUMN IF NOT EXISTS pinned_notat text,
  ADD COLUMN IF NOT EXISTS pinned_notat_av text,
  ADD COLUMN IF NOT EXISTS pinned_notat_dato timestamp with time zone;

ALTER TABLE public.prosjekter
  ADD COLUMN IF NOT EXISTS pinned_notat text,
  ADD COLUMN IF NOT EXISTS pinned_notat_av text,
  ADD COLUMN IF NOT EXISTS pinned_notat_dato timestamp with time zone;