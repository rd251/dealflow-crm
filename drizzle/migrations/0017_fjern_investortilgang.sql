-- Kun @snakk.ai-ansatte får tilgang. Investorunntaket fjernes.
CREATE OR REPLACE FUNCTION public.epost_har_tilgang(_epost text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(_epost, '')) LIKE '%@snakk.ai'
$$;

-- Ingen nye investorroller tildeles.
CREATE OR REPLACE FUNCTION public.grant_investor_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Ingen beholder investorinnsyn.
CREATE OR REPLACE FUNCTION public.har_investorinnsyn(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false
$$;
