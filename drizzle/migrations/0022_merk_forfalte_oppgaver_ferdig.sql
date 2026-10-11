UPDATE public.oppgaver
SET status = 'Ferdig', updated_at = now()
WHERE status <> 'Ferdig' AND frist < CURRENT_DATE;