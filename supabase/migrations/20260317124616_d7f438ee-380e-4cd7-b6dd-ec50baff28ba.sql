-- Fix oppgaver inserts for projects running without authentication
-- Existing app uses public CRUD while auth session is absent, so user_id must not block inserts.

ALTER TABLE public.oppgaver
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.oppgaver
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.oppgaver
  DROP CONSTRAINT IF EXISTS oppgaver_user_id_fkey;