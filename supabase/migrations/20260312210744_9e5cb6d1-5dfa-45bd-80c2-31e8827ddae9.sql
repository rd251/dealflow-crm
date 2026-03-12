
CREATE TYPE public.aktivitet_type AS ENUM (
  'Telefonsamtale',
  'E-post',
  'LinkedIn-melding',
  'SMS',
  'Møte',
  'Notat'
);

CREATE TABLE public.aktiviteter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type aktivitet_type NOT NULL,
  beskrivelse text NOT NULL DEFAULT '',
  dato timestamp with time zone NOT NULL DEFAULT now(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  salgsmulighet_id uuid REFERENCES public.salgsmuligheter(id) ON DELETE CASCADE,
  selskap_id uuid REFERENCES public.selskaper(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.partnere(id) ON DELETE CASCADE,
  prosjekt_id uuid REFERENCES public.prosjekter(id) ON DELETE CASCADE,
  kontakt_id uuid REFERENCES public.kontakter(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.aktiviteter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read aktiviteter" ON public.aktiviteter FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert aktiviteter" ON public.aktiviteter FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update aktiviteter" ON public.aktiviteter FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete aktiviteter" ON public.aktiviteter FOR DELETE TO anon, authenticated USING (true);
