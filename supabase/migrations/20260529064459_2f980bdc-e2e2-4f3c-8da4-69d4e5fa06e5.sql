DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')
          AND n.nspname = 'public'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl.table_name);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl.table_name);
    END LOOP;
END;
$$;

DO $$
DECLARE
    seq record;
BEGIN
    FOR seq IN
        SELECT c.relname AS sequence_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'S'
          AND n.nspname = 'public'
    LOOP
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', seq.sequence_name);
        EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', seq.sequence_name);
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.onboarding_svar') IS NOT NULL THEN
        GRANT INSERT ON TABLE public.onboarding_svar TO anon;
    END IF;

    IF to_regclass('public.email_unsubscribe_tokens') IS NOT NULL THEN
        GRANT SELECT, UPDATE ON TABLE public.email_unsubscribe_tokens TO anon;
    END IF;
END;
$$;