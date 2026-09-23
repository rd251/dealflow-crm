CREATE TABLE public.dublett_ignorert (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  id_a uuid NOT NULL,
  id_b uuid NOT NULL,
  ignorert_av uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, id_a, id_b)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dublett_ignorert TO authenticated;
GRANT ALL ON public.dublett_ignorert TO service_role;

ALTER TABLE public.dublett_ignorert ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interne kan se ignorerte dubletter"
ON public.dublett_ignorert FOR SELECT TO authenticated
USING (public.er_intern(auth.uid()));

CREATE POLICY "Interne kan ignorere dubletter"
ON public.dublett_ignorert FOR INSERT TO authenticated
WITH CHECK (public.er_intern(auth.uid()));

CREATE POLICY "Interne kan fjerne ignorering"
ON public.dublett_ignorert FOR DELETE TO authenticated
USING (public.er_intern(auth.uid()));