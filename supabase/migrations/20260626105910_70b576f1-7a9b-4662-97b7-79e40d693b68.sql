
-- Partner pricing tiers (cost from us → partner)
CREATE TABLE public.partner_prismodell (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partnere(id) ON DELETE CASCADE,
  trinn_navn text NOT NULL,
  min_kunder integer NOT NULL,
  max_kunder integer,
  kostpris_per_minutt numeric NOT NULL,
  sortering integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_prismodell TO authenticated;
GRANT ALL ON public.partner_prismodell TO service_role;
ALTER TABLE public.partner_prismodell ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view partner_prismodell"
  ON public.partner_prismodell FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert partner_prismodell"
  ON public.partner_prismodell FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update partner_prismodell"
  ON public.partner_prismodell FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete partner_prismodell"
  ON public.partner_prismodell FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_partner_prismodell_updated
BEFORE UPDATE ON public.partner_prismodell
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Partner packages (what partner sells to end customer)
CREATE TABLE public.partner_pakker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partnere(id) ON DELETE CASCADE,
  navn text NOT NULL,
  beskrivelse text,
  inkluderte_minutter integer NOT NULL DEFAULT 0,
  utsalgspris_sluttkunde numeric NOT NULL DEFAULT 0,
  ekstra_min_pris numeric NOT NULL DEFAULT 0,
  aktiv boolean NOT NULL DEFAULT true,
  sortering integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_pakker TO authenticated;
GRANT ALL ON public.partner_pakker TO service_role;
ALTER TABLE public.partner_pakker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view partner_pakker"
  ON public.partner_pakker FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert partner_pakker"
  ON public.partner_pakker FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update partner_pakker"
  ON public.partner_pakker FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete partner_pakker"
  ON public.partner_pakker FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_partner_pakker_updated
BEFORE UPDATE ON public.partner_pakker
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
