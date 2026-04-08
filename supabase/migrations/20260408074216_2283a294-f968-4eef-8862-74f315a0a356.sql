ALTER TABLE public.selskaper ADD COLUMN IF NOT EXISTS firmaadresse text DEFAULT '' NOT NULL;
ALTER TABLE public.selskaper ADD COLUMN IF NOT EXISTS postadresse text DEFAULT '' NOT NULL;