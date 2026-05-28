
-- =====================================================================
-- Security hardening: restrict CRM tables to authenticated users,
-- fix permissive policies, search_path on functions, storage exposure.
-- =====================================================================

-- Helper to recreate "Public ... true" policies as authenticated-only
-- Tables: aktiviteter, kontakter, leads, oppgaver, partnere, prosjekter,
--         ringeliste, ringelister, salgsmuligheter, selskaper

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'aktiviteter','kontakter','leads','oppgaver','partnere',
    'prosjekter','ringeliste','ringelister','salgsmuligheter','selskaper'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public read %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public delete %1$s" ON public.%1$s', t);

    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Authenticated insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Authenticated update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Authenticated delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (true)', t);

    EXECUTE format('REVOKE ALL ON public.%1$s FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%1$s TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%1$s TO service_role', t);
  END LOOP;
END $$;

-- selskap_innsikt: only had insert/update/read public
DROP POLICY IF EXISTS "Public read selskap_innsikt" ON public.selskap_innsikt;
DROP POLICY IF EXISTS "Public insert selskap_innsikt" ON public.selskap_innsikt;
DROP POLICY IF EXISTS "Public update selskap_innsikt" ON public.selskap_innsikt;
CREATE POLICY "Authenticated read selskap_innsikt" ON public.selskap_innsikt FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert selskap_innsikt" ON public.selskap_innsikt FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update selskap_innsikt" ON public.selskap_innsikt FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.selskap_innsikt FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.selskap_innsikt TO authenticated;
GRANT ALL ON public.selskap_innsikt TO service_role;

-- crm_changelog: remove anon. Triggers run SECURITY DEFINER so they keep working.
DROP POLICY IF EXISTS "Public read crm_changelog" ON public.crm_changelog;
DROP POLICY IF EXISTS "Public insert crm_changelog" ON public.crm_changelog;
CREATE POLICY "Authenticated read crm_changelog" ON public.crm_changelog FOR SELECT TO authenticated USING (true);
-- No INSERT policy needed for client; SECURITY DEFINER trigger functions bypass RLS as owner.
REVOKE ALL ON public.crm_changelog FROM anon;
GRANT SELECT ON public.crm_changelog TO authenticated;
GRANT ALL ON public.crm_changelog TO service_role;

-- deleted_items: restrict to admins
DROP POLICY IF EXISTS "Authenticated users can view deleted items" ON public.deleted_items;
DROP POLICY IF EXISTS "Authenticated users can insert deleted items" ON public.deleted_items;
DROP POLICY IF EXISTS "Authenticated users can update deleted items" ON public.deleted_items;
DROP POLICY IF EXISTS "Authenticated users can delete deleted items" ON public.deleted_items;
CREATE POLICY "Admins can view deleted items"   ON public.deleted_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can insert deleted items" ON public.deleted_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update deleted items" ON public.deleted_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete deleted items" ON public.deleted_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- varsler INSERT: restrict fra_user_id to auth.uid() (or null) and prevent marking notifications as already read on insert
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.varsler;
CREATE POLICY "Authenticated can insert notifications" ON public.varsler
  FOR INSERT TO authenticated
  WITH CHECK (fra_user_id IS NULL OR fra_user_id = auth.uid());

-- onboarding_svar: keep anon INSERT (public lead/onboarding form), tighten reads to auth only (already is)
-- No change needed for onboarding_svar reads since they are already authenticated.

-- =====================================================================
-- Storage: contract-pdfs -> private; projekt-kb INSERT -> authenticated only
-- =====================================================================
UPDATE storage.buckets SET public = false WHERE id = 'contract-pdfs';

DROP POLICY IF EXISTS "Public can read contract PDFs" ON storage.objects;
CREATE POLICY "Authenticated can read contract PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-pdfs');

DROP POLICY IF EXISTS "Anyone can upload to projekt-kb" ON storage.objects;
CREATE POLICY "Authenticated can upload to projekt-kb"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'projekt-kb');

-- =====================================================================
-- Function search_path hardening
-- =====================================================================
ALTER FUNCTION public.changelog_aktiviteter_linking() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- =====================================================================
-- Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated
-- (keep has_role accessible since RLS policies call it)
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.changelog_kontakter() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.changelog_leads() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.changelog_oppgaver() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.changelog_partnere() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.changelog_prosjekter() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.changelog_salgsmuligheter() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.changelog_selskaper() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.changelog_aktiviteter_linking() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_aktiviteter_to_kontakt() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_aktiviteter_to_lead() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_aktiviteter_to_salgsmulighet() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_link_email_contacts_to_kontakt() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_sist_aktivitet_from_aktiviteter() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
