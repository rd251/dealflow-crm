
-- Create CRM changelog table
CREATE TABLE public.crm_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- created, updated, converted, linked, completed, deleted
  entity_type text NOT NULL, -- lead, salgsmulighet, selskap, kontakt, oppgave, partner, prosjekt
  entity_id uuid NOT NULL,
  entity_name text NOT NULL DEFAULT '',
  field_name text, -- which field changed (for updates)
  old_value text,
  new_value text,
  related_entity_type text, -- for links/conversions
  related_entity_id uuid,
  related_entity_name text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_crm_changelog_created_at ON public.crm_changelog(created_at DESC);
CREATE INDEX idx_crm_changelog_entity ON public.crm_changelog(entity_type, entity_id);

-- RLS
ALTER TABLE public.crm_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read crm_changelog" ON public.crm_changelog FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert crm_changelog" ON public.crm_changelog FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_changelog;

-- ==============================
-- TRIGGER FUNCTIONS
-- ==============================

-- 1. Kontakter: opprettet + selskap_id endret (kobling)
CREATE OR REPLACE FUNCTION public.changelog_kontakter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name)
    VALUES ('created', 'kontakt', NEW.id, NEW.navn);
    -- If linked to company on creation
    IF NEW.selskap_id IS NOT NULL THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'kontakt', NEW.id, NEW.navn, 'selskap', NEW.selskap_id,
        COALESCE((SELECT firmanavn FROM selskaper WHERE id = NEW.selskap_id), ''));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- selskap_id changed = linking
    IF (OLD.selskap_id IS DISTINCT FROM NEW.selskap_id) AND NEW.selskap_id IS NOT NULL THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'kontakt', NEW.id, NEW.navn, 'selskap', NEW.selskap_id,
        COALESCE((SELECT firmanavn FROM selskaper WHERE id = NEW.selskap_id), ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_kontakter
  AFTER INSERT OR UPDATE ON public.kontakter
  FOR EACH ROW EXECUTE FUNCTION public.changelog_kontakter();

-- 2. Selskaper: opprettet
CREATE OR REPLACE FUNCTION public.changelog_selskaper()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name)
    VALUES ('created', 'selskap', NEW.id, NEW.firmanavn);
  ELSIF TG_OP = 'UPDATE' THEN
    -- kundestatus endret
    IF OLD.kundestatus IS DISTINCT FROM NEW.kundestatus THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'selskap', NEW.id, NEW.firmanavn, 'kundestatus', OLD.kundestatus, NEW.kundestatus);
    END IF;
    -- kundeansvarlig endret
    IF OLD.kundeansvarlig IS DISTINCT FROM NEW.kundeansvarlig AND NEW.kundeansvarlig != '' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'selskap', NEW.id, NEW.firmanavn, 'ansvarlig', COALESCE(OLD.kundeansvarlig, ''), NEW.kundeansvarlig);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_selskaper
  AFTER INSERT OR UPDATE ON public.selskaper
  FOR EACH ROW EXECUTE FUNCTION public.changelog_selskaper();

-- 3. Salgsmuligheter: opprettet + status/verdi/ansvarlig endret + kontakt/selskap koblet
CREATE OR REPLACE FUNCTION public.changelog_salgsmuligheter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name)
    VALUES ('created', 'salgsmulighet', NEW.id, NEW.navn);
    -- If linked to company on creation
    IF NEW.selskap_id IS NOT NULL THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'salgsmulighet', NEW.id, NEW.navn, 'selskap', NEW.selskap_id,
        COALESCE((SELECT firmanavn FROM selskaper WHERE id = NEW.selskap_id), ''));
    END IF;
    IF NEW.kontakt_id IS NOT NULL THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'salgsmulighet', NEW.id, NEW.navn, 'kontakt', NEW.kontakt_id,
        COALESCE((SELECT navn FROM kontakter WHERE id = NEW.kontakt_id), ''));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- status endret
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'salgsmulighet', NEW.id, NEW.navn, 'status', OLD.status, NEW.status);
    END IF;
    -- forventet_mrr endret
    IF OLD.forventet_mrr IS DISTINCT FROM NEW.forventet_mrr THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'salgsmulighet', NEW.id, NEW.navn, 'verdi', COALESCE(OLD.forventet_mrr::text, '0'), COALESCE(NEW.forventet_mrr::text, '0'));
    END IF;
    -- ansvarlig endret
    IF OLD.ansvarlig IS DISTINCT FROM NEW.ansvarlig AND NEW.ansvarlig != '' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'salgsmulighet', NEW.id, NEW.navn, 'ansvarlig', COALESCE(OLD.ansvarlig, ''), NEW.ansvarlig);
    END IF;
    -- selskap koblet
    IF (OLD.selskap_id IS DISTINCT FROM NEW.selskap_id) AND NEW.selskap_id IS NOT NULL THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'salgsmulighet', NEW.id, NEW.navn, 'selskap', NEW.selskap_id,
        COALESCE((SELECT firmanavn FROM selskaper WHERE id = NEW.selskap_id), ''));
    END IF;
    -- kontakt koblet
    IF (OLD.kontakt_id IS DISTINCT FROM NEW.kontakt_id) AND NEW.kontakt_id IS NOT NULL THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'salgsmulighet', NEW.id, NEW.navn, 'kontakt', NEW.kontakt_id,
        COALESCE((SELECT navn FROM kontakter WHERE id = NEW.kontakt_id), ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_salgsmuligheter
  AFTER INSERT OR UPDATE ON public.salgsmuligheter
  FOR EACH ROW EXECUTE FUNCTION public.changelog_salgsmuligheter();

-- 4. Leads: opprettet + konvertering
CREATE OR REPLACE FUNCTION public.changelog_leads()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name)
    VALUES ('created', 'lead', NEW.id, NEW.firmanavn);
  ELSIF TG_OP = 'UPDATE' THEN
    -- status endret
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Check for conversions
      IF NEW.status = 'Konvertert til salg' THEN
        INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
        VALUES ('converted', 'lead', NEW.id, NEW.firmanavn, 'status', OLD.status, 'Salgsmulighet');
      ELSIF NEW.status = 'Konvertert til partner' THEN
        INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
        VALUES ('converted', 'lead', NEW.id, NEW.firmanavn, 'status', OLD.status, 'Partner');
      ELSE
        INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
        VALUES ('updated', 'lead', NEW.id, NEW.firmanavn, 'status', OLD.status, NEW.status);
      END IF;
    END IF;
    -- ansvarlig endret
    IF OLD.ansvarlig IS DISTINCT FROM NEW.ansvarlig AND NEW.ansvarlig != '' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'lead', NEW.id, NEW.firmanavn, 'ansvarlig', COALESCE(OLD.ansvarlig, ''), NEW.ansvarlig);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_leads
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.changelog_leads();

-- 5. Oppgaver: opprettet + fullført + slettet
CREATE OR REPLACE FUNCTION public.changelog_oppgaver()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, user_id)
    VALUES ('created', 'oppgave', NEW.id, NEW.oppgave, NEW.user_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Ferdig' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, user_id)
      VALUES ('completed', 'oppgave', NEW.id, NEW.oppgave, NEW.user_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name)
    VALUES ('deleted', 'oppgave', OLD.id, OLD.oppgave);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_oppgaver
  AFTER INSERT OR UPDATE OR DELETE ON public.oppgaver
  FOR EACH ROW EXECUTE FUNCTION public.changelog_oppgaver();

-- 6. Partnere: opprettet
CREATE OR REPLACE FUNCTION public.changelog_partnere()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name)
    VALUES ('created', 'partner', NEW.id, NEW.partnernavn);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.partnerstatus IS DISTINCT FROM NEW.partnerstatus THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'partner', NEW.id, NEW.partnernavn, 'partnerstatus', OLD.partnerstatus, NEW.partnerstatus);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_partnere
  AFTER INSERT OR UPDATE ON public.partnere
  FOR EACH ROW EXECUTE FUNCTION public.changelog_partnere();

-- 7. Prosjekter: opprettet + status endret
CREATE OR REPLACE FUNCTION public.changelog_prosjekter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name)
    VALUES ('created', 'prosjekt', NEW.id, NEW.prosjektnavn);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, field_name, old_value, new_value)
      VALUES ('updated', 'prosjekt', NEW.id, NEW.prosjektnavn, 'status', OLD.status, NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_prosjekter
  AFTER INSERT OR UPDATE ON public.prosjekter
  FOR EACH ROW EXECUTE FUNCTION public.changelog_prosjekter();

-- 8. Aktiviteter: only log email/meeting linkings (not raw events)
CREATE OR REPLACE FUNCTION public.changelog_aktiviteter_linking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- E-post koblet til kontakt
    IF OLD.kontakt_id IS NULL AND NEW.kontakt_id IS NOT NULL AND NEW.ekstern_provider = 'gmail' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'epost', NEW.id, COALESCE(NEW.tittel, 'E-post'), 'kontakt', NEW.kontakt_id,
        COALESCE((SELECT navn FROM kontakter WHERE id = NEW.kontakt_id), ''));
    END IF;
    -- E-post koblet til salgsmulighet
    IF OLD.salgsmulighet_id IS NULL AND NEW.salgsmulighet_id IS NOT NULL AND NEW.ekstern_provider = 'gmail' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'epost', NEW.id, COALESCE(NEW.tittel, 'E-post'), 'salgsmulighet', NEW.salgsmulighet_id,
        COALESCE((SELECT navn FROM salgsmuligheter WHERE id = NEW.salgsmulighet_id), ''));
    END IF;
    -- Møte koblet til kontakt
    IF OLD.kontakt_id IS NULL AND NEW.kontakt_id IS NOT NULL AND NEW.ekstern_provider = 'google_calendar' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'møte', NEW.id, COALESCE(NEW.tittel, 'Møte'), 'kontakt', NEW.kontakt_id,
        COALESCE((SELECT navn FROM kontakter WHERE id = NEW.kontakt_id), ''));
    END IF;
    -- Møte koblet til salgsmulighet
    IF OLD.salgsmulighet_id IS NULL AND NEW.salgsmulighet_id IS NOT NULL AND NEW.ekstern_provider = 'google_calendar' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'møte', NEW.id, COALESCE(NEW.tittel, 'Møte'), 'salgsmulighet', NEW.salgsmulighet_id,
        COALESCE((SELECT navn FROM salgsmuligheter WHERE id = NEW.salgsmulighet_id), ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_changelog_aktiviteter_linking
  AFTER UPDATE ON public.aktiviteter
  FOR EACH ROW EXECUTE FUNCTION public.changelog_aktiviteter_linking();
