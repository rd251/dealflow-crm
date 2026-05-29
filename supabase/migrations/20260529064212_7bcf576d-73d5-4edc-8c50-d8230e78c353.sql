DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.relname);
  END LOOP;
END $$;

-- Tabeller som tillater anonym tilgang (offentlige skjemaer / token-flyt)
GRANT INSERT ON public.onboarding_svar TO anon;
GRANT SELECT, UPDATE ON public.email_unsubscribe_tokens TO anon;