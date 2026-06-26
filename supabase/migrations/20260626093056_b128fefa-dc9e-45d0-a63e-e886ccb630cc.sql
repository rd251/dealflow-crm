ALTER PUBLICATION supabase_realtime DROP TABLE public.crm_changelog;

DROP POLICY IF EXISTS "Authenticated users can update company docs" ON storage.objects;
CREATE POLICY "Admins can update company docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'company-documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'company-documents' AND public.has_role(auth.uid(), 'admin'));