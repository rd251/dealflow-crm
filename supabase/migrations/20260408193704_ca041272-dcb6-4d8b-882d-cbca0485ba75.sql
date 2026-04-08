
-- Add 'Skjema mottatt' to prosjekt_status enum
ALTER TYPE public.prosjekt_status ADD VALUE IF NOT EXISTS 'Skjema mottatt' AFTER 'Ny';

-- Create onboarding_svar table
CREATE TABLE public.onboarding_svar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prosjekt_id UUID REFERENCES public.prosjekter(id) ON DELETE SET NULL,
  svar JSONB NOT NULL DEFAULT '{}'::jsonb,
  kontakt_navn TEXT NOT NULL DEFAULT '',
  kontakt_epost TEXT NOT NULL DEFAULT '',
  firmanavn TEXT NOT NULL DEFAULT '',
  filer TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_svar ENABLE ROW LEVEL SECURITY;

-- Public can insert (anonymous form submission)
CREATE POLICY "Anyone can submit onboarding form"
  ON public.onboarding_svar FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated can read
CREATE POLICY "Authenticated can read onboarding answers"
  ON public.onboarding_svar FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated can update/delete
CREATE POLICY "Authenticated can update onboarding answers"
  ON public.onboarding_svar FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete onboarding answers"
  ON public.onboarding_svar FOR DELETE
  TO authenticated
  USING (true);

-- Create projekt-kb storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('projekt-kb', 'projekt-kb', false);

-- Anyone can upload to projekt-kb (public onboarding form)
CREATE POLICY "Anyone can upload to projekt-kb"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'projekt-kb');

-- Authenticated can view files
CREATE POLICY "Authenticated can view projekt-kb files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'projekt-kb');

-- Authenticated can delete files
CREATE POLICY "Authenticated can delete projekt-kb files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'projekt-kb');
