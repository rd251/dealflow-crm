CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated can read app settings"
ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings"
ON public.app_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.sync_lead_to_brevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.e_post IS NULL OR NEW.e_post !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://tchmujgzcklwgptocbno.supabase.co/functions/v1/brevo-sync-lead',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('record', to_jsonb(NEW))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_to_brevo ON public.leads;
CREATE TRIGGER trg_sync_lead_to_brevo
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_to_brevo();