
-- Ringeliste (call list) table
CREATE TABLE public.ringeliste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  navn text NOT NULL,
  e_post text DEFAULT '',
  telefon text DEFAULT '',
  selskap text DEFAULT '',
  rolle text DEFAULT '',
  prioritet text DEFAULT 'Lav' CHECK (prioritet IN ('Høy', 'Medium', 'Lav')),
  status text DEFAULT 'Ikke ringt' CHECK (status IN ('Ikke ringt', 'Ringt', 'Booket møte', 'Ikke interessert', 'Send info', 'Ring igjen', 'Konvertert')),
  utfall text DEFAULT '',
  notater text DEFAULT '',
  ansvarlig text DEFAULT '',
  sist_kontaktet timestamp with time zone,
  kontakt_id uuid,
  selskap_id uuid,
  salgsmulighet_id uuid,
  partner_id uuid,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER update_ringeliste_updated_at
  BEFORE UPDATE ON public.ringeliste
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.ringeliste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ringeliste" ON public.ringeliste FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert ringeliste" ON public.ringeliste FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update ringeliste" ON public.ringeliste FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete ringeliste" ON public.ringeliste FOR DELETE TO anon, authenticated USING (true);
