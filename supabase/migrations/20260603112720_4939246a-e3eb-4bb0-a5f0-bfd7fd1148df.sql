
-- 1) google_calendar_connections: hide OAuth tokens from client. RLS stays; revoke broad SELECT and grant column-level SELECT excluding access_token/refresh_token.
REVOKE SELECT ON public.google_calendar_connections FROM authenticated, anon;
GRANT SELECT (
  id, user_id, calendar_id, last_synced_at, sync_token,
  gmail_last_synced_at, gmail_sync_enabled, gmail_history_id,
  token_expires_at, created_at, updated_at
) ON public.google_calendar_connections TO authenticated;

-- 2) contract-pdfs: remove broad SELECT policy, serve only via signed URLs (service role).
DROP POLICY IF EXISTS "Authenticated can read contract PDFs" ON storage.objects;

-- 3) company-documents: add UPDATE policy (parity with INSERT/SELECT/DELETE)
DROP POLICY IF EXISTS "Authenticated users can update company docs" ON storage.objects;
CREATE POLICY "Authenticated users can update company docs"
ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'company-documents')
WITH CHECK (bucket_id = 'company-documents');

-- 4) SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated where not needed.
-- Trigger functions (only called via triggers):
REVOKE EXECUTE ON FUNCTION public.changelog_partnere() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.changelog_selskaper() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.changelog_salgsmuligheter() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.changelog_aktiviteter_linking() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.changelog_prosjekter() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.changelog_leads() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.changelog_kontakter() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.changelog_oppgaver() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_link_email_contacts_to_kontakt() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_link_aktiviteter_to_kontakt() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_link_aktiviteter_to_lead() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_link_aktiviteter_to_salgsmulighet() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_sist_aktivitet_from_aktiviteter() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

-- pgmq wrappers (only called by service_role edge functions):
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;

-- Note: has_role(uuid, app_role) intentionally remains executable by authenticated — it's used inside RLS policies.
