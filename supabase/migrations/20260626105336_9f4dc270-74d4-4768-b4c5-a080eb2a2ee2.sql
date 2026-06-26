
-- contract-pdfs: restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated can view contract-pdfs" ON storage.objects;
CREATE POLICY "Admins can view contract-pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contract-pdfs'
  AND public.has_role(auth.uid(), 'admin')
);

-- onboarding_svar: remove anonymous INSERT; submissions must go through edge function
DROP POLICY IF EXISTS "Anyone can submit onboarding form" ON public.onboarding_svar;
