DROP POLICY IF EXISTS "Authenticated users can read company docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload company docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company docs" ON storage.objects;

CREATE POLICY "Interne kan lese company docs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'company-documents' AND public.er_intern((select auth.uid())));

CREATE POLICY "Redaktorer kan laste opp company docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-documents' AND public.kan_redigere_crm((select auth.uid())));

CREATE POLICY "Redaktorer kan slette company docs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'company-documents' AND public.kan_redigere_crm((select auth.uid())));