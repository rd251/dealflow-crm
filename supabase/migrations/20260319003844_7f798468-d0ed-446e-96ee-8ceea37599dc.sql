
-- Table to store per-user Google Calendar OAuth connections
CREATE TABLE public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_token text,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own connection
CREATE POLICY "Users can view own connection" ON public.google_calendar_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own connection" ON public.google_calendar_connections
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own connection" ON public.google_calendar_connections
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own connection" ON public.google_calendar_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());
