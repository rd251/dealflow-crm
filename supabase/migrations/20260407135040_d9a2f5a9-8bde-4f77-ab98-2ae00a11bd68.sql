
-- Update the trigger to skip changelog entries for auto-synced calendar/gmail events
CREATE OR REPLACE FUNCTION changelog_aktiviteter_linking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Skip auto-synced events (calendar sync, gmail sync) to avoid changelog spam
    IF NEW.aktivitet_kilde IN ('google_calendar', 'gmail') THEN
      RETURN NEW;
    END IF;

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
    -- Møte koblet til kontakt (only manual links)
    IF OLD.kontakt_id IS NULL AND NEW.kontakt_id IS NOT NULL AND NEW.ekstern_provider = 'google_calendar' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'møte', NEW.id, COALESCE(NEW.tittel, 'Møte'), 'kontakt', NEW.kontakt_id,
        COALESCE((SELECT navn FROM kontakter WHERE id = NEW.kontakt_id), ''));
    END IF;
    -- Møte koblet til salgsmulighet (only manual links)
    IF OLD.salgsmulighet_id IS NULL AND NEW.salgsmulighet_id IS NOT NULL AND NEW.ekstern_provider = 'google_calendar' THEN
      INSERT INTO crm_changelog(event_type, entity_type, entity_id, entity_name, related_entity_type, related_entity_id, related_entity_name)
      VALUES ('linked', 'møte', NEW.id, COALESCE(NEW.tittel, 'Møte'), 'salgsmulighet', NEW.salgsmulighet_id,
        COALESCE((SELECT navn FROM salgsmuligheter WHERE id = NEW.salgsmulighet_id), ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Clean up existing spam: delete duplicate "linked møte Boiler room" entries
DELETE FROM crm_changelog
WHERE event_type = 'linked'
  AND entity_type = 'møte'
  AND entity_name = 'Boiler room';
