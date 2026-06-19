ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS videresendt_til_partner_id uuid REFERENCES public.partnere(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS videresendt_dato date;

CREATE INDEX IF NOT EXISTS idx_leads_videresendt_partner ON public.leads(videresendt_til_partner_id);