ALTER TABLE public.selskap_dokumenter
  ADD COLUMN IF NOT EXISTS ai_uttrekk jsonb,
  ADD COLUMN IF NOT EXISTS ai_uttrukket_dato timestamptz,
  ADD COLUMN IF NOT EXISTS salgsmulighet_id uuid;

ALTER TABLE public.salgsmuligheter
  ADD COLUMN IF NOT EXISTS kontrakt_startdato date;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.selskap_dokumenter TO authenticated;
GRANT ALL ON public.selskap_dokumenter TO service_role;

DROP POLICY IF EXISTS "Authenticated users can update company documents" ON public.selskap_dokumenter;
CREATE POLICY "Authenticated users can update company documents"
  ON public.selskap_dokumenter FOR UPDATE TO authenticated
  USING (public.kan_redigere_crm(auth.uid()))
  WITH CHECK (public.kan_redigere_crm(auth.uid()));