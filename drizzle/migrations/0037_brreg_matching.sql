ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS orgnr text,
  ADD COLUMN IF NOT EXISTS brreg_status text,
  ADD COLUMN IF NOT EXISTS brreg_kandidater jsonb,
  ADD COLUMN IF NOT EXISTS brreg_data jsonb,
  ADD COLUMN IF NOT EXISTS brreg_hentet timestamptz;
ALTER TABLE public.selskaper
  ADD COLUMN IF NOT EXISTS brreg_status text,
  ADD COLUMN IF NOT EXISTS brreg_kandidater jsonb,
  ADD COLUMN IF NOT EXISTS brreg_data jsonb,
  ADD COLUMN IF NOT EXISTS brreg_hentet timestamptz;
COMMENT ON TABLE public.selskap_innsikt IS 'DEPRECATED: replaced by brreg_* columns on leads and selskaper';