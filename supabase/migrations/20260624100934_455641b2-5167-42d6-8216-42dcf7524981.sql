
-- 1) contract-pdfs: add explicit SELECT policy for authenticated team members
DROP POLICY IF EXISTS "Authenticated can view contract-pdfs" ON storage.objects;
CREATE POLICY "Authenticated can view contract-pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contract-pdfs');

-- 2) google_calendar_connections: add explicit deny SELECT policy for authenticated (defense in depth)
DROP POLICY IF EXISTS "Deny direct SELECT of OAuth tokens" ON public.google_calendar_connections;
CREATE POLICY "Deny direct SELECT of OAuth tokens"
  ON public.google_calendar_connections FOR SELECT
  TO authenticated
  USING (false);

-- 3) onboarding_svar: restrict reads/updates/deletes to admins only (anon INSERT preserved)
DROP POLICY IF EXISTS "Authenticated can read onboarding answers" ON public.onboarding_svar;
DROP POLICY IF EXISTS "Authenticated can update onboarding answers" ON public.onboarding_svar;
DROP POLICY IF EXISTS "Authenticated can delete onboarding answers" ON public.onboarding_svar;

CREATE POLICY "Admins can read onboarding answers"
  ON public.onboarding_svar FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update onboarding answers"
  ON public.onboarding_svar FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete onboarding answers"
  ON public.onboarding_svar FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
