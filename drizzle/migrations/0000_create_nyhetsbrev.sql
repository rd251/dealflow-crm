CREATE TABLE public.nyhetsbrev (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tittel text NOT NULL,
  emne text NOT NULL,
  preheader text,
  innhold_html text,
  innhold_json jsonb,
  status text NOT NULL DEFAULT 'utkast',
  mottaker_antall int,
  aapnet_antall int NOT NULL DEFAULT 0,
  klikk_antall int NOT NULL DEFAULT 0,
  brevo_campaign_id bigint,
  sendt_dato timestamptz,
  planlagt_dato timestamptz,
  opprettet_dato timestamptz NOT NULL DEFAULT now(),
  opprettet_av uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nyhetsbrev TO authenticated;
GRANT ALL ON public.nyhetsbrev TO service_role;
ALTER TABLE public.nyhetsbrev ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view nyhetsbrev" ON public.nyhetsbrev FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert nyhetsbrev" ON public.nyhetsbrev FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update nyhetsbrev" ON public.nyhetsbrev FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete nyhetsbrev" ON public.nyhetsbrev FOR DELETE TO authenticated USING (true);

CREATE TABLE public.nyhetsbrev_mottakere (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nyhetsbrev_id uuid REFERENCES public.nyhetsbrev(id) ON DELETE CASCADE,
  e_post text NOT NULL,
  firmanavn text,
  kilde text,
  kilde_id uuid,
  status text NOT NULL DEFAULT 'sendt',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nyhetsbrev_mottakere TO authenticated;
GRANT ALL ON public.nyhetsbrev_mottakere TO service_role;
ALTER TABLE public.nyhetsbrev_mottakere ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mottakere" ON public.nyhetsbrev_mottakere FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert mottakere" ON public.nyhetsbrev_mottakere FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update mottakere" ON public.nyhetsbrev_mottakere FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete mottakere" ON public.nyhetsbrev_mottakere FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_nyhetsbrev_mottakere_nb ON public.nyhetsbrev_mottakere(nyhetsbrev_id);

-- Global avmelding for nyhetsbrev
CREATE TABLE public.nyhetsbrev_avmeldte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  e_post text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.nyhetsbrev_avmeldte TO authenticated;
GRANT ALL ON public.nyhetsbrev_avmeldte TO service_role;
ALTER TABLE public.nyhetsbrev_avmeldte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view avmeldte" ON public.nyhetsbrev_avmeldte FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert avmeldte" ON public.nyhetsbrev_avmeldte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete avmeldte" ON public.nyhetsbrev_avmeldte FOR DELETE TO authenticated USING (true);
