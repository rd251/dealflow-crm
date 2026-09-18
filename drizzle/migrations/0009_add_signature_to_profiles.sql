ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signatur_navn text,
  ADD COLUMN IF NOT EXISTS signatur_tittel text,
  ADD COLUMN IF NOT EXISTS signatur_selskap text;

UPDATE public.profiles
SET signatur_navn = COALESCE(signatur_navn, 'Robin Sæter Diallo'),
    signatur_tittel = COALESCE(signatur_tittel, 'Head of Sales & Partner'),
    signatur_selskap = COALESCE(signatur_selskap, 'Snakk')
WHERE email = 'rd@snakk.ai';