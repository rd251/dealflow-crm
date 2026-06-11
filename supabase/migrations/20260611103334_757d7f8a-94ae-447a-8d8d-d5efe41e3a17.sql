
-- Restrict direct client access to OAuth tokens in google_calendar_connections.
-- Tokens must only be readable by edge functions (service_role).

REVOKE ALL ON TABLE public.google_calendar_connections FROM anon, authenticated;

-- Allow authenticated owners to read only non-sensitive columns (no tokens, no sync_token, no gmail_history_id)
GRANT SELECT (id, user_id, calendar_id, last_synced_at, created_at, updated_at, gmail_sync_enabled, gmail_last_synced_at)
  ON public.google_calendar_connections TO authenticated;

-- Allow authenticated owners to toggle Gmail sync only
GRANT UPDATE (gmail_sync_enabled) ON public.google_calendar_connections TO authenticated;

-- Allow authenticated owners to delete their own connection
GRANT DELETE ON public.google_calendar_connections TO authenticated;

-- Edge functions retain full access
GRANT ALL ON public.google_calendar_connections TO service_role;

-- Remove INSERT policy from authenticated; inserts only happen via the OAuth callback edge function (service_role)
DROP POLICY IF EXISTS "Users can insert own connection" ON public.google_calendar_connections;
