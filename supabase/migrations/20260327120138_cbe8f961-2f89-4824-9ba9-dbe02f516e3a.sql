
CREATE TABLE public.varsler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'oppgave_delegert',
  tittel text NOT NULL,
  beskrivelse text NOT NULL DEFAULT '',
  lest boolean NOT NULL DEFAULT false,
  lenke text DEFAULT '',
  oppgave_id uuid REFERENCES public.oppgaver(id) ON DELETE CASCADE,
  fra_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.varsler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.varsler FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated can insert notifications" ON public.varsler FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.varsler FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON public.varsler FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.varsler;
