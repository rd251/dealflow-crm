
CREATE OR REPLACE FUNCTION public.sync_sist_aktivitet_from_aktiviteter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update lead's sist_aktivitet
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE leads
    SET sist_aktivitet = NEW.dato::date
    WHERE id = NEW.lead_id
      AND (sist_aktivitet IS NULL OR sist_aktivitet < NEW.dato::date);
  END IF;

  -- Update salgsmulighet's sist_aktivitet
  IF NEW.salgsmulighet_id IS NOT NULL THEN
    UPDATE salgsmuligheter
    SET sist_aktivitet = NEW.dato::date
    WHERE id = NEW.salgsmulighet_id
      AND (sist_aktivitet IS NULL OR sist_aktivitet < NEW.dato::date);
  END IF;

  -- Update selskap's sist_aktivitet
  IF NEW.selskap_id IS NOT NULL THEN
    UPDATE selskaper
    SET sist_aktivitet = NEW.dato::date
    WHERE id = NEW.selskap_id
      AND (sist_aktivitet IS NULL OR sist_aktivitet < NEW.dato::date);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_sist_aktivitet
AFTER INSERT OR UPDATE ON aktiviteter
FOR EACH ROW
EXECUTE FUNCTION sync_sist_aktivitet_from_aktiviteter();
