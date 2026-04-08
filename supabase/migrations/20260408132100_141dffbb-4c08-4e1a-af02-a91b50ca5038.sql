
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-pdfs', 'contract-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload contract PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contract-pdfs');

CREATE POLICY "Public can read contract PDFs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'contract-pdfs');

CREATE POLICY "Service role full access contract PDFs"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'contract-pdfs')
WITH CHECK (bucket_id = 'contract-pdfs');
