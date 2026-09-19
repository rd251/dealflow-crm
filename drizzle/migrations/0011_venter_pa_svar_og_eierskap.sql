-- Del 1: «venter på svar»-sporing
CREATE TABLE public.venter_pa_svar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kontakt_id uuid REFERENCES public.kontakter(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  salgsmulighet_id uuid REFERENCES public.salgsmuligheter(id) ON DELETE CASCADE,
  selskap_id uuid REFERENCES public.selskaper(id) ON DELETE CASCADE,
  e_post text,
  thread_id text NOT NULL,
  emne text,
  aktivitet_id uuid REFERENCES public.aktiviteter(id) ON DELETE SET NULL,
  sendt_dato timestamptz NOT NULL DEFAULT now(),
  ai_begrunnelse text,
  status text NOT NULL DEFAULT 'venter',
  varslet_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX venter_pa_svar_user_thread_idx ON public.venter_pa_svar(user_id, thread_id);
CREATE INDEX venter_pa_svar_status_idx ON public.venter_pa_svar(status, sendt_dato);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venter_pa_svar TO authenticated;
GRANT ALL ON public.venter_pa_svar TO service_role;

ALTER TABLE public.venter_pa_svar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Egne venter-på-svar kan leses"
  ON public.venter_pa_svar FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Egne venter-på-svar kan opprettes"
  ON public.venter_pa_svar FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Egne venter-på-svar kan endres"
  ON public.venter_pa_svar FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Egne venter-på-svar kan slettes"
  ON public.venter_pa_svar FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER venter_pa_svar_updated_at
  BEFORE UPDATE ON public.venter_pa_svar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Personlige innstillinger per bruker
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nudge_aktiv boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nudge_dager integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS ukesagenda_aktiv boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daglig_epost_aktiv boolean NOT NULL DEFAULT true;

-- Del 2: eierskap
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS eier_id uuid;
ALTER TABLE public.salgsmuligheter ADD COLUMN IF NOT EXISTS eier_id uuid;
ALTER TABLE public.selskaper ADD COLUMN IF NOT EXISTS eier_id uuid;
ALTER TABLE public.partnere ADD COLUMN IF NOT EXISTS eier_id uuid;

CREATE INDEX IF NOT EXISTS leads_eier_idx ON public.leads(eier_id);
CREATE INDEX IF NOT EXISTS salgsmuligheter_eier_idx ON public.salgsmuligheter(eier_id);
CREATE INDEX IF NOT EXISTS selskaper_eier_idx ON public.selskaper(eier_id);
CREATE INDEX IF NOT EXISTS partnere_eier_idx ON public.partnere(eier_id);

UPDATE public.leads l SET eier_id = p.user_id
FROM public.profiles p
WHERE l.eier_id IS NULL AND l.ansvarlig IS NOT NULL AND l.ansvarlig <> ''
  AND lower(p.display_name) = lower(l.ansvarlig);

UPDATE public.salgsmuligheter s SET eier_id = p.user_id
FROM public.profiles p
WHERE s.eier_id IS NULL AND s.ansvarlig IS NOT NULL AND s.ansvarlig <> ''
  AND lower(p.display_name) = lower(s.ansvarlig);

UPDATE public.selskaper c SET eier_id = p.user_id
FROM public.profiles p
WHERE c.eier_id IS NULL AND c.kundeansvarlig IS NOT NULL AND c.kundeansvarlig <> ''
  AND lower(p.display_name) = lower(c.kundeansvarlig);

UPDATE public.partnere pa SET eier_id = p.user_id
FROM public.profiles p
WHERE pa.eier_id IS NULL AND pa.ansvarlig IS NOT NULL AND pa.ansvarlig <> ''
  AND lower(p.display_name) = lower(pa.ansvarlig);

-- Aktivitetslogg: registrer alltid hvem som utførte handlingen
CREATE OR REPLACE FUNCTION public.set_aktivitet_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_aktivitet_user_id
  BEFORE INSERT ON public.aktiviteter
  FOR EACH ROW EXECUTE FUNCTION public.set_aktivitet_user_id();

-- Ny aktivitet med en person/deal avslutter «venter på svar»
CREATE OR REPLACE FUNCTION public.clear_venter_pa_svar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.venter_pa_svar v
  SET status = 'besvart', updated_at = now()
  WHERE v.status = 'venter'
    AND v.sendt_dato < NEW.dato
    AND (
      (NEW.kontakt_id IS NOT NULL AND v.kontakt_id = NEW.kontakt_id)
      OR (NEW.lead_id IS NOT NULL AND v.lead_id = NEW.lead_id)
      OR (NEW.salgsmulighet_id IS NOT NULL AND v.salgsmulighet_id = NEW.salgsmulighet_id)
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clear_venter_pa_svar
  AFTER INSERT ON public.aktiviteter
  FOR EACH ROW EXECUTE FUNCTION public.clear_venter_pa_svar();