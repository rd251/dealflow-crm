DROP POLICY IF EXISTS "Authenticated can view projekt-kb files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload to projekt-kb" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete projekt-kb files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload contract PDFs" ON storage.objects;

CREATE POLICY "Interne kan lese projekt-kb"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'projekt-kb' AND public.er_intern((SELECT auth.uid())));

CREATE POLICY "Redaktorer kan laste opp projekt-kb"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'projekt-kb' AND public.kan_redigere_crm((SELECT auth.uid())));

CREATE POLICY "Redaktorer kan slette projekt-kb"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'projekt-kb' AND public.kan_redigere_crm((SELECT auth.uid())));

CREATE POLICY "Redaktorer kan laste opp kontrakt-PDF"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contract-pdfs' AND public.kan_redigere_crm((SELECT auth.uid())));