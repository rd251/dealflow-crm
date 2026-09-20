-- Ny status for prosjekter
ALTER TYPE public.prosjekt_status ADD VALUE IF NOT EXISTS 'Klar for live';

-- Additive felter på prosjekter
ALTER TABLE public.prosjekter
  ADD COLUMN IF NOT EXISTS onboarding_type text NOT NULL DEFAULT 'Selvbetjening',
  ADD COLUMN IF NOT EXISTS onboarding_steg jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS timepris numeric NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS notater_ansvarlig text;

-- Timeregistrering
CREATE TABLE IF NOT EXISTS public.prosjekt_timer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prosjekt_id uuid REFERENCES public.prosjekter(id) ON DELETE CASCADE,
  selskap_id uuid REFERENCES public.selskaper(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'Oppsett',
  beskrivelse text NOT NULL DEFAULT '',
  dato date NOT NULL DEFAULT CURRENT_DATE,
  timer numeric NOT NULL DEFAULT 0,
  timepris numeric NOT NULL DEFAULT 1500,
  fakturert boolean NOT NULL DEFAULT false,
  fakturert_dato date,
  opprettet_av uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prosjekt_timer TO authenticated;
GRANT ALL ON public.prosjekt_timer TO service_role;

ALTER TABLE public.prosjekt_timer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interne kan se prosjekt_timer" ON public.prosjekt_timer
  FOR SELECT TO authenticated USING (public.er_intern(auth.uid()));
CREATE POLICY "Interne kan legge til prosjekt_timer" ON public.prosjekt_timer
  FOR INSERT TO authenticated WITH CHECK (public.er_intern(auth.uid()));
CREATE POLICY "Interne kan endre prosjekt_timer" ON public.prosjekt_timer
  FOR UPDATE TO authenticated USING (public.er_intern(auth.uid()));
CREATE POLICY "Interne kan slette prosjekt_timer" ON public.prosjekt_timer
  FOR DELETE TO authenticated USING (public.er_intern(auth.uid()));

CREATE TRIGGER prosjekt_timer_updated_at BEFORE UPDATE ON public.prosjekt_timer
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_prosjekt_timer_prosjekt ON public.prosjekt_timer(prosjekt_id);
CREATE INDEX IF NOT EXISTS idx_prosjekt_timer_selskap ON public.prosjekt_timer(selskap_id);