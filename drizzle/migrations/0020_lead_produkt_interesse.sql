ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS produkt_interesse text[],
  ADD COLUMN IF NOT EXISTS produkt_oppsummering text,
  ADD COLUMN IF NOT EXISTS produkt_analysert_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_produkt_analysert
  ON public.leads (produkt_analysert_at NULLS FIRST);