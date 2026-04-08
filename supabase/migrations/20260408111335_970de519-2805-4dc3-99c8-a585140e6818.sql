
-- Create storage bucket for company documents
INSERT INTO storage.buckets (id, name, public) VALUES ('company-documents', 'company-documents', false);

-- Create metadata table for uploaded documents
CREATE TABLE public.selskap_dokumenter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selskap_id uuid NOT NULL,
  fil_navn text NOT NULL,
  fil_type text NOT NULL DEFAULT '',
  fil_sti text NOT NULL,
  opplastet_av text NOT NULL DEFAULT '',
  opplastet_av_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.selskap_dokumenter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company documents"
  ON public.selskap_dokumenter FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company documents"
  ON public.selskap_dokumenter FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete company documents"
  ON public.selskap_dokumenter FOR DELETE TO authenticated
  USING (true);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload company docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-documents');

CREATE POLICY "Authenticated users can read company docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-documents');

CREATE POLICY "Authenticated users can delete company docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-documents');
