ALTER TABLE public.salgsmuligheter
ADD COLUMN IF NOT EXISTS ai_recap jsonb DEFAULT NULL;