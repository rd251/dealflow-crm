
-- Trigger 1: When a kontakt is created/updated with an e_post, auto-link email_contacts.kontakt_id
CREATE OR REPLACE FUNCTION public.auto_link_email_contacts_to_kontakt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.e_post IS NOT NULL AND NEW.e_post != '' THEN
    UPDATE email_contacts
    SET kontakt_id = NEW.id,
        selskap_id = COALESCE(email_contacts.selskap_id, NEW.selskap_id)
    WHERE lower(primary_email) = lower(NEW.e_post)
      AND kontakt_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kontakt_auto_link_email_contacts
AFTER INSERT OR UPDATE OF e_post ON public.kontakter
FOR EACH ROW EXECUTE FUNCTION public.auto_link_email_contacts_to_kontakt();

-- Trigger 2: When a kontakt is created/updated, auto-link orphaned aktiviteter by matching email in beskrivelse
CREATE OR REPLACE FUNCTION public.auto_link_aktiviteter_to_kontakt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.e_post IS NOT NULL AND NEW.e_post != '' THEN
    UPDATE aktiviteter
    SET kontakt_id = NEW.id,
        selskap_id = COALESCE(aktiviteter.selskap_id, NEW.selskap_id)
    WHERE kontakt_id IS NULL
      AND type = 'E-post'
      AND ekstern_provider = 'gmail'
      AND beskrivelse ILIKE '%[' || NEW.e_post || ']%';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kontakt_auto_link_aktiviteter
AFTER INSERT OR UPDATE OF e_post ON public.kontakter
FOR EACH ROW EXECUTE FUNCTION public.auto_link_aktiviteter_to_kontakt();

-- Trigger 3: When a lead is created/updated with an e_post, auto-link orphaned aktiviteter
CREATE OR REPLACE FUNCTION public.auto_link_aktiviteter_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.e_post IS NOT NULL AND NEW.e_post != '' THEN
    UPDATE aktiviteter
    SET lead_id = NEW.id
    WHERE lead_id IS NULL
      AND kontakt_id IS NULL
      AND salgsmulighet_id IS NULL
      AND type = 'E-post'
      AND ekstern_provider = 'gmail'
      AND beskrivelse ILIKE '%[' || NEW.e_post || ']%';
    
    -- Also link email_contacts
    UPDATE email_contacts
    SET lead_id = NEW.id
    WHERE lower(primary_email) = lower(NEW.e_post)
      AND lead_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_auto_link_aktiviteter
AFTER INSERT OR UPDATE OF e_post ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.auto_link_aktiviteter_to_lead();

-- Trigger 4: When a salgsmulighet is created/updated with e_post, auto-link orphaned aktiviteter
CREATE OR REPLACE FUNCTION public.auto_link_aktiviteter_to_salgsmulighet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.e_post IS NOT NULL AND NEW.e_post != '' THEN
    UPDATE aktiviteter
    SET salgsmulighet_id = NEW.id,
        selskap_id = COALESCE(aktiviteter.selskap_id, NEW.selskap_id)
    WHERE salgsmulighet_id IS NULL
      AND type = 'E-post'
      AND ekstern_provider = 'gmail'
      AND beskrivelse ILIKE '%[' || NEW.e_post || ']%';
    
    -- Also link email_contacts
    UPDATE email_contacts
    SET salgsmulighet_id = NEW.id,
        selskap_id = COALESCE(email_contacts.selskap_id, NEW.selskap_id)
    WHERE lower(primary_email) = lower(NEW.e_post)
      AND salgsmulighet_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_salgsmulighet_auto_link_aktiviteter
AFTER INSERT OR UPDATE OF e_post ON public.salgsmuligheter
FOR EACH ROW EXECUTE FUNCTION public.auto_link_aktiviteter_to_salgsmulighet();
