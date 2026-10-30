CREATE OR REPLACE FUNCTION public.oppgave_til_kalender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.status::text = 'Ferdig' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.frist IS NOT DISTINCT FROM OLD.frist
      AND NEW.frist_tid IS NOT DISTINCT FROM OLD.frist_tid THEN
      RETURN NEW;
    END IF;
  END IF;
  BEGIN
    PERFORM net.http_post(url := 'https://tchmujgzcklwgptocbno.supabase.co/functions/v1/oppgave-kalender',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('oppgave_id', NEW.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'oppgave-kalender: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_oppgave_kalender
AFTER INSERT OR UPDATE OF frist, frist_tid ON public.oppgaver
FOR EACH ROW EXECUTE FUNCTION public.oppgave_til_kalender();