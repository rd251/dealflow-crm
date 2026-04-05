
-- Create ringelister (folder/campaign) table
CREATE TABLE public.ringelister (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  navn TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT '',
  kanal TEXT NOT NULL DEFAULT '',
  partnertype_segment TEXT NOT NULL DEFAULT '',
  kilde_segment TEXT NOT NULL DEFAULT '',
  ansvarlig TEXT DEFAULT '',
  notater TEXT DEFAULT '',
  user_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ringelister ENABLE ROW LEVEL SECURITY;

-- Public CRUD policies (matching ringeliste pattern)
CREATE POLICY "Public read ringelister" ON public.ringelister FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert ringelister" ON public.ringelister FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update ringelister" ON public.ringelister FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete ringelister" ON public.ringelister FOR DELETE TO anon, authenticated USING (true);

-- updated_at trigger
CREATE TRIGGER update_ringelister_updated_at BEFORE UPDATE ON public.ringelister
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add ringeliste_id FK to ringeliste (contacts) table
ALTER TABLE public.ringeliste ADD COLUMN ringeliste_id UUID REFERENCES public.ringelister(id) ON DELETE CASCADE DEFAULT NULL;
