
-- 1) Restrict crm_changelog reads to admins
DROP POLICY IF EXISTS "Authenticated read crm_changelog" ON public.crm_changelog;
CREATE POLICY "Admins can read crm_changelog"
  ON public.crm_changelog
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Remove direct SELECT on google_calendar_connections (contains OAuth tokens).
-- Expose only non-sensitive status fields via a security_invoker view.
DROP POLICY IF EXISTS "Users can view own connection" ON public.google_calendar_connections;

CREATE OR REPLACE VIEW public.google_calendar_connection_status
WITH (security_invoker = true) AS
SELECT
  user_id,
  last_synced_at,
  gmail_sync_enabled,
  gmail_last_synced_at,
  created_at,
  updated_at
FROM public.google_calendar_connections
WHERE user_id = auth.uid();

GRANT SELECT ON public.google_calendar_connection_status TO authenticated;

-- The base table keeps UPDATE/DELETE policies scoped to the owner so users
-- can still disconnect / toggle settings, but the row (with tokens) is no
-- longer readable from the client. All reads of tokens go through service_role
-- edge functions only.
