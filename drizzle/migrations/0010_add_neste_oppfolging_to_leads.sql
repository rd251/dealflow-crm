ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS neste_oppfolging date;

UPDATE public.leads
SET neste_oppfolging = (COALESCE(sist_aktivitet, opprettet_dato, CURRENT_DATE) + INTERVAL '5 days')::date
WHERE neste_oppfolging IS NULL
  AND konvertert_dato IS NULL
  AND status NOT IN ('Ikke aktuelt', 'Konvertert til salg', 'Konvertert til partner');

CREATE INDEX IF NOT EXISTS leads_neste_oppfolging_idx ON public.leads (neste_oppfolging);