ALTER TABLE public.salgsmuligheter
  ADD COLUMN IF NOT EXISTS videresendt_til_partner_id uuid REFERENCES public.partnere(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS videresendt_dato date;

CREATE INDEX IF NOT EXISTS idx_salgsmuligheter_videresendt_til_partner_id
  ON public.salgsmuligheter(videresendt_til_partner_id);