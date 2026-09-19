-- Hvem er intern ansatt (alt annet enn investor)
CREATE OR REPLACE FUNCTION public.er_intern(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','user','viewer')
  )
$$;

CREATE OR REPLACE FUNCTION public.har_investorinnsyn(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','user','viewer','investor')
  )
$$;

-- Allowlist for investorer
CREATE TABLE public.investor_tilgang (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  e_post text NOT NULL UNIQUE,
  navn text,
  aktiv boolean NOT NULL DEFAULT true,
  opprettet_av uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_tilgang TO authenticated;
GRANT ALL ON public.investor_tilgang TO service_role;

ALTER TABLE public.investor_tilgang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leser investortilgang" ON public.investor_tilgang
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins legger til investortilgang" ON public.investor_tilgang
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins endrer investortilgang" ON public.investor_tilgang
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins sletter investortilgang" ON public.investor_tilgang
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER investor_tilgang_updated_at
  BEFORE UPDATE ON public.investor_tilgang
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rolletildeling: verifisert e-post i allowlisten gir investorrollen
CREATE OR REPLACE FUNCTION public.grant_investor_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.investor_tilgang
    WHERE aktiv AND lower(e_post) = lower(NEW.email)
  ) THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.id AND role <> 'investor';
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'investor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_investor
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_investor_role();

CREATE TRIGGER on_auth_user_confirmed_grant_investor
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_investor_role();

-- Investorer skal aldri nå CRM-data: restriktiv sperre på toppen av dagens policyer
CREATE POLICY "Kun interne" ON public.leads AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.salgsmuligheter AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.aktiviteter AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.kontakter AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.partnere AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.selskaper AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.prosjekter AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.oppgaver AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.ringeliste AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.ringelister AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.email_contacts AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.venter_pa_svar AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.partner_pakker AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.partner_prismodell AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.selskap_dokumenter AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.selskap_innsikt AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.nyhetsbrev AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.nyhetsbrev_mottakere AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.deleted_items AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Kun interne" ON public.onboarding_svar AS RESTRICTIVE TO authenticated USING (public.er_intern(auth.uid())) WITH CHECK (public.er_intern(auth.uid()));

-- Investorvisning: kun aggregater, ingen dialog eller kontaktinfo
CREATE VIEW public.investor_portefolje AS
SELECT
  s.id,
  s.firmanavn,
  s.bransje,
  CASE WHEN s.kundestatus = 'Live' THEN 'Aktiv'
       WHEN s.kundestatus = 'Pause' THEN 'Pause'
       WHEN s.kundestatus = 'Pilot' THEN 'Pilot'
       ELSE 'Avsluttet' END AS status,
  COALESCE(s.mrr, 0)::numeric AS mrr,
  COALESCE(s.arr, COALESCE(s.mrr, 0) * 12)::numeric AS arr,
  s.go_live_dato AS kunde_siden
FROM public.selskaper s
WHERE s.kundestatus IN ('Live','Pause','Pilot')
  AND public.har_investorinnsyn(auth.uid());

CREATE VIEW public.investor_noekkeltall AS
SELECT
  COALESCE(SUM(CASE WHEN s.kundestatus = 'Live' THEN COALESCE(s.mrr,0) ELSE 0 END), 0)::numeric AS total_mrr,
  COALESCE(SUM(CASE WHEN s.kundestatus = 'Live' THEN COALESCE(s.mrr,0) ELSE 0 END), 0)::numeric * 12 AS total_arr,
  COUNT(*) FILTER (WHERE s.kundestatus = 'Live')::int AS antall_aktive,
  COUNT(*) FILTER (WHERE s.kundestatus = 'Pause')::int AS antall_pause,
  COUNT(*) FILTER (WHERE s.kundestatus = 'Kansellert'
    AND s.kansellert_dato >= (CURRENT_DATE - INTERVAL '12 months'))::int AS antall_churn_12m,
  COALESCE(SUM(CASE WHEN s.partner_id IS NOT NULL AND s.kundestatus = 'Live'
    THEN COALESCE(s.mrr,0) ELSE 0 END), 0)::numeric AS partner_mrr
FROM public.selskaper s
WHERE public.har_investorinnsyn(auth.uid());

CREATE VIEW public.investor_mrr_trend AS
WITH maneder AS (
  SELECT (date_trunc('month', CURRENT_DATE) - (n || ' months')::interval)::date AS mnd
  FROM generate_series(11, 0, -1) AS n
)
SELECT
  m.mnd,
  COALESCE((
    SELECT SUM(COALESCE(s.mrr,0)) FROM public.selskaper s
    WHERE s.go_live_dato IS NOT NULL
      AND s.go_live_dato <= (m.mnd + INTERVAL '1 month' - INTERVAL '1 day')
      AND (s.kansellert_dato IS NULL OR s.kansellert_dato > (m.mnd + INTERVAL '1 month' - INTERVAL '1 day'))
  ), 0)::numeric AS mrr,
  COALESCE((
    SELECT SUM(COALESCE(s.mrr,0)) FROM public.selskaper s
    WHERE s.go_live_dato >= m.mnd AND s.go_live_dato < (m.mnd + INTERVAL '1 month')
  ), 0)::numeric AS ny_mrr,
  COALESCE((
    SELECT SUM(COALESCE(s.mrr,0)) FROM public.selskaper s
    WHERE s.kansellert_dato >= m.mnd AND s.kansellert_dato < (m.mnd + INTERVAL '1 month')
  ), 0)::numeric AS churn_mrr
FROM maneder m
WHERE public.har_investorinnsyn(auth.uid());

GRANT SELECT ON public.investor_portefolje TO authenticated;
GRANT SELECT ON public.investor_noekkeltall TO authenticated;
GRANT SELECT ON public.investor_mrr_trend TO authenticated;