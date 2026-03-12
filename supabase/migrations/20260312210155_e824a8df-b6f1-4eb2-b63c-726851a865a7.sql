ALTER TABLE public.salgsmuligheter
  ADD COLUMN IF NOT EXISTS kontaktperson text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS e_post text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS telefon text DEFAULT ''::text;