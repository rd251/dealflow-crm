-- Snakk CRM er internt: kun @snakk.ai-kontoer (og investorer på allowlist) får konto.
CREATE OR REPLACE FUNCTION public.epost_har_tilgang(_epost text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(_epost, '')) LIKE '%@snakk.ai'
     OR EXISTS (
       SELECT 1 FROM public.investor_tilgang it
       WHERE lower(it.e_post) = lower(coalesce(_epost, '')) AND it.aktiv
     )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.epost_har_tilgang(NEW.email) THEN
    RAISE EXCEPTION 'Snakk CRM er kun for ansatte i Snakk Teknologi AS (@snakk.ai).'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;