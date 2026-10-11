-- lovable-cron-fallback-reviewed: wake-on-enqueue per new lead, unscheduled after drain; 5-min delay required
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS velkomst_status text,
  ADD COLUMN IF NOT EXISTS velkomst_sendt_at timestamptz,
  ADD COLUMN IF NOT EXISTS velkomst_feil text;

CREATE OR REPLACE FUNCTION public.lead_velkomst_planlegg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron, extensions AS $$
BEGIN
  IF coalesce(trim(NEW.e_post),'') = '' OR NEW.e_post ILIKE '%@snakk.ai' THEN
    RETURN NEW;
  END IF;
  UPDATE public.leads SET velkomst_status = 'venter' WHERE id = NEW.id;
  BEGIN
    PERFORM cron.schedule('lead-velkomst', '* * * * *',
      $c$select net.http_post(url := 'https://tchmujgzcklwgptocbno.supabase.co/functions/v1/lead-velkomst', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb);$c$);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'lead-velkomst: kunne ikke planlegge: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_velkomst ON public.leads;
CREATE TRIGGER trg_lead_velkomst AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.lead_velkomst_planlegg();

CREATE OR REPLACE FUNCTION public.lead_velkomst_stopp()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE velkomst_status = 'venter') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'lead-velkomst';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.lead_velkomst_stopp() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_velkomst_stopp() TO service_role;
REVOKE ALL ON FUNCTION public.lead_velkomst_planlegg() FROM PUBLIC, anon, authenticated;