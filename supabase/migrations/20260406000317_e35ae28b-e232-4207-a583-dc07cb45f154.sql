
CREATE TABLE public.selskap_innsikt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domene text NOT NULL DEFAULT '',
  firmanavn text NOT NULL DEFAULT '',
  bransje text,
  beskrivelse text,
  stoerrelse text,
  estimert_ansatte text,
  estimert_omsetning text,
  orgnr text,
  kilde_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domene)
);

ALTER TABLE public.selskap_innsikt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read selskap_innsikt" ON public.selskap_innsikt FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert selskap_innsikt" ON public.selskap_innsikt FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update selskap_innsikt" ON public.selskap_innsikt FOR UPDATE TO anon, authenticated USING (true);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.selskap_innsikt
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
