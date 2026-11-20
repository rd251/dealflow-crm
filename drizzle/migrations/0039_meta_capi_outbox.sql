-- CRM -> Meta Conversions API (Conversion Leads) transactional outbox.

-- 1) Stable lineage from CRM records to their original Meta lead.
CREATE TABLE public.meta_capi_koblinger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  salgsmulighet_id uuid UNIQUE REFERENCES public.salgsmuligheter(id) ON DELETE CASCADE,
  kilde_lead_id uuid,
  meta_lead_event_id uuid NOT NULL REFERENCES public.meta_lead_events(id) ON DELETE CASCADE,
  leadgen_id text NOT NULL CHECK (leadgen_id ~ '^[0-9]{6,20}$'),
  lead_opprettet_meta timestamptz,
  metode text NOT NULL CHECK (metode IN ('import','e_post','aktivitet')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_capi_koblinger_en_crm_post CHECK ((lead_id IS NULL) <> (salgsmulighet_id IS NULL))
);
COMMENT ON TABLE public.meta_capi_koblinger IS 'Stable link from a lead or sales opportunity to its original Meta leadgen_id. Set once, never rewritten.';

GRANT SELECT ON public.meta_capi_koblinger TO authenticated;
GRANT ALL ON public.meta_capi_koblinger TO service_role;
ALTER TABLE public.meta_capi_koblinger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read meta capi koblinger"
ON public.meta_capi_koblinger FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Outbox of CRM stage events.
CREATE TABLE public.meta_capi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  miljo text NOT NULL DEFAULT 'produksjon' CHECK (miljo IN ('produksjon','test')),
  milestone_key text NOT NULL UNIQUE,
  event_id text NOT NULL UNIQUE,
  event_name text NOT NULL,
  stage_key text NOT NULL,
  event_time timestamptz NOT NULL,
  leadgen_id text NOT NULL CHECK (leadgen_id ~ '^[0-9]{6,20}$'),
  lead_opprettet_meta timestamptz,
  meta_lead_event_id uuid REFERENCES public.meta_lead_events(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  salgsmulighet_id uuid REFERENCES public.salgsmuligheter(id) ON DELETE SET NULL,
  kilde text NOT NULL,
  test_event_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  claim_token uuid,
  last_error text,
  meta_respons jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_capi_events_test_isolert CHECK (
    (miljo = 'test' AND test_event_code IS NOT NULL AND milestone_key LIKE 'test:%')
    OR (miljo = 'produksjon' AND test_event_code IS NULL AND milestone_key NOT LIKE 'test:%')
  )
);
COMMENT ON TABLE public.meta_capi_events IS 'Outbox of CRM stage events for Meta Conversions API (Conversion Leads). One row per leadgen_id and stage; filled by triggers, drained by meta-capi-worker.';
CREATE INDEX meta_capi_events_ko_idx ON public.meta_capi_events (miljo, status, next_attempt_at);
CREATE INDEX meta_capi_events_leadgen_idx ON public.meta_capi_events (leadgen_id);

GRANT SELECT ON public.meta_capi_events TO authenticated;
GRANT ALL ON public.meta_capi_events TO service_role;
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read meta capi events"
ON public.meta_capi_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Operational state (singleton). Missing row = disabled.
CREATE TABLE public.meta_capi_state (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  produksjon_aktiv boolean NOT NULL DEFAULT false,
  pauset boolean NOT NULL DEFAULT false,
  aktivert_at timestamptz,
  aktivert_av uuid,
  test_ok_at timestamptz,
  test_sist_at timestamptz,
  test_sist_resultat text,
  last_run_at timestamptz,
  last_sent_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  last_error_kind text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_capi_state TO authenticated;
GRANT ALL ON public.meta_capi_state TO service_role;
ALTER TABLE public.meta_capi_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read meta capi state"
ON public.meta_capi_state FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4) Stage mapping (mirrored by functions/_shared/meta-capi.ts and src/lib/meta-capi.ts).
CREATE OR REPLACE FUNCTION public.meta_capi_steg(p_type text, p_status text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_type
    WHEN 'lead' THEN CASE p_status
      WHEN 'Ny' THEN ARRAY['lead_ny','Lead: Ny']
      WHEN 'Kontaktet' THEN ARRAY['lead_kontaktet','Lead: Kontaktet']
      WHEN 'Svarte ikke telefon' THEN ARRAY['lead_svarte_ikke','Lead: Svarte ikke telefon']
      WHEN 'Kvalifisert' THEN ARRAY['lead_kvalifisert','Lead: Kvalifisert']
      WHEN 'Ikke aktuelt' THEN ARRAY['lead_ikke_aktuelt','Lead: Ikke aktuelt']
      WHEN 'Konvertert til salg' THEN ARRAY['lead_til_salgsmulighet','Lead: Konvertert til salgsmulighet']
      WHEN 'Konvertert til partner' THEN ARRAY['lead_til_partner','Lead: Konvertert til partner']
      ELSE NULL END
    WHEN 'salgsmulighet' THEN CASE p_status
      WHEN 'Møte booket' THEN ARRAY['salg_mote_booket','Salgsmulighet: Møte booket']
      WHEN 'Demo gjennomført' THEN ARRAY['salg_demo_gjennomfort','Salgsmulighet: Demo gjennomført']
      WHEN 'Behov avklart' THEN ARRAY['salg_demo_gjennomfort','Salgsmulighet: Demo gjennomført']
      WHEN 'Løsning presentert' THEN ARRAY['salg_demo_gjennomfort','Salgsmulighet: Demo gjennomført']
      WHEN 'Demo-prosjekt' THEN ARRAY['salg_demo_prosjekt','Salgsmulighet: Demo-prosjekt']
      WHEN 'Tilbud sendt' THEN ARRAY['salg_tilbud_sendt','Salgsmulighet: Tilbud sendt']
      WHEN 'Kontrakt sendt' THEN ARRAY['salg_kontrakt_sendt','Salgsmulighet: Kontrakt sendt']
      WHEN 'Vunnet' THEN ARRAY['salg_vunnet','Salgsmulighet: Vunnet']
      WHEN 'Tapt' THEN ARRAY['salg_tapt','Salgsmulighet: Tapt']
      ELSE NULL END
    ELSE NULL END
$$;

-- 5) Lead anchor: the earliest successfully imported Meta lead for a CRM lead, stored once.
CREATE OR REPLACE FUNCTION public.meta_capi_lead_anker(p_lead_id uuid)
RETURNS public.meta_capi_koblinger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  k public.meta_capi_koblinger;
  e public.meta_lead_events;
BEGIN
  IF p_lead_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO k FROM public.meta_capi_koblinger WHERE lead_id = p_lead_id;
  IF k.id IS NOT NULL THEN RETURN k; END IF;
  SELECT * INTO e FROM public.meta_lead_events
  WHERE lead_id = p_lead_id AND status = 'done' AND leadgen_id ~ '^[0-9]{6,20}$'
  ORDER BY coalesce(created_time, received_at), received_at, id
  LIMIT 1;
  IF e.id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.meta_capi_koblinger (lead_id, meta_lead_event_id, leadgen_id, lead_opprettet_meta, metode)
  VALUES (p_lead_id, e.id, e.leadgen_id, e.created_time, 'import')
  ON CONFLICT DO NOTHING;
  SELECT * INTO k FROM public.meta_capi_koblinger WHERE lead_id = p_lead_id;
  RETURN k;
END;
$$;

-- 6) Enqueue one milestone; the first time a stage is reached wins, later repeats are ignored.
CREATE OR REPLACE FUNCTION public.meta_capi_legg_i_ko(
  p_leadgen_id text, p_meta_lead_event_id uuid, p_lead_opprettet timestamptz,
  p_steg text[], p_kilde text, p_lead_id uuid, p_salgsmulighet_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_steg IS NULL OR p_leadgen_id IS NULL OR p_leadgen_id !~ '^[0-9]{6,20}$' THEN RETURN; END IF;
  INSERT INTO public.meta_capi_events (
    milestone_key, event_id, event_name, stage_key, event_time, leadgen_id,
    lead_opprettet_meta, meta_lead_event_id, lead_id, salgsmulighet_id, kilde
  ) VALUES (
    p_leadgen_id || ':' || p_steg[1], 'snakk-crm:' || p_leadgen_id || ':' || p_steg[1],
    p_steg[2], p_steg[1], now(), p_leadgen_id,
    p_lead_opprettet, p_meta_lead_event_id, p_lead_id, p_salgsmulighet_id, p_kilde
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- 7) Trigger: a new Meta import (status becomes done with a lead) -> initial stage for that leadgen_id.
CREATE OR REPLACE FUNCTION public.meta_capi_ved_import()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE k public.meta_capi_koblinger;
BEGIN
  IF NEW.status <> 'done' OR NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'done' THEN RETURN NEW; END IF;
  BEGIN
    k := public.meta_capi_lead_anker(NEW.lead_id);
    PERFORM public.meta_capi_legg_i_ko(NEW.leadgen_id, NEW.id, NEW.created_time,
      public.meta_capi_steg('lead', 'Ny'), 'meta_import', NEW.lead_id, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'meta-capi: import kunne ikke legges i kø (%)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_capi_import
AFTER INSERT OR UPDATE OF status, lead_id ON public.meta_lead_events
FOR EACH ROW EXECUTE FUNCTION public.meta_capi_ved_import();

-- 8) Trigger: lead status change on a Meta lead -> stage for the lead's original leadgen_id.
CREATE OR REPLACE FUNCTION public.meta_capi_ved_lead_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  k public.meta_capi_koblinger;
  steg text[];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  steg := public.meta_capi_steg('lead', NEW.status::text);
  -- The initial stage is only reported from a real import.
  IF steg IS NULL OR steg[1] = 'lead_ny' THEN RETURN NEW; END IF;
  -- Re-entering an old conversion is history, not a new conversion.
  IF steg[1] IN ('lead_til_salgsmulighet','lead_til_partner')
     AND NEW.konvertert_dato IS NOT NULL AND NEW.konvertert_dato < current_date - 7 THEN
    RETURN NEW;
  END IF;
  BEGIN
    k := public.meta_capi_lead_anker(NEW.id);
    IF k.id IS NULL THEN RETURN NEW; END IF;
    PERFORM public.meta_capi_legg_i_ko(k.leadgen_id, k.meta_lead_event_id, k.lead_opprettet_meta,
      steg, 'lead_status', NEW.id, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'meta-capi: leadstatus kunne ikke legges i kø (%)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_capi_lead_status
AFTER UPDATE OF status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.meta_capi_ved_lead_status();

-- 9) Trigger: sales opportunity stage -> stage for the original leadgen_id of its Meta lead.
CREATE OR REPLACE FUNCTION public.meta_capi_ved_salgsmulighet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  k public.meta_capi_koblinger;
  a public.meta_capi_koblinger;
  steg text[];
  v_epost text;
  v_leads uuid[];
  v_metode text;
BEGIN
  BEGIN
    SELECT * INTO k FROM public.meta_capi_koblinger WHERE salgsmulighet_id = NEW.id;
    IF k.id IS NULL THEN
      v_epost := lower(trim(coalesce(NEW.e_post, '')));
      IF v_epost LIKE '%_@_%' THEN
        SELECT array_agg(DISTINCT l.id) INTO v_leads
        FROM public.leads l
        WHERE lower(trim(coalesce(l.e_post, ''))) = v_epost
          AND l.status::text IS DISTINCT FROM 'Konvertert til partner'
          AND EXISTS (SELECT 1 FROM public.meta_lead_events e WHERE e.lead_id = l.id AND e.status = 'done');
        v_metode := 'e_post';
      END IF;
      IF coalesce(cardinality(v_leads), 0) = 0 THEN
        SELECT array_agg(DISTINCT ak.lead_id) INTO v_leads
        FROM public.aktiviteter ak
        JOIN public.leads l ON l.id = ak.lead_id
        WHERE ak.salgsmulighet_id = NEW.id
          AND ak.ekstern_provider = 'meta_lead_ads'
          AND l.status::text IS DISTINCT FROM 'Konvertert til partner';
        v_metode := 'aktivitet';
      END IF;
      -- Only an unambiguous relation to exactly one Meta lead counts.
      IF coalesce(cardinality(v_leads), 0) = 1 THEN
        a := public.meta_capi_lead_anker(v_leads[1]);
        IF a.id IS NOT NULL THEN
          INSERT INTO public.meta_capi_koblinger (salgsmulighet_id, kilde_lead_id, meta_lead_event_id, leadgen_id, lead_opprettet_meta, metode)
          VALUES (NEW.id, v_leads[1], a.meta_lead_event_id, a.leadgen_id, a.lead_opprettet_meta, v_metode)
          ON CONFLICT DO NOTHING;
          SELECT * INTO k FROM public.meta_capi_koblinger WHERE salgsmulighet_id = NEW.id;
        END IF;
      END IF;
    END IF;

    IF k.id IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
    steg := public.meta_capi_steg('salgsmulighet', NEW.status::text);
    IF steg IS NULL THEN RETURN NEW; END IF;
    -- Re-entering an old win or loss is history, not a new event.
    IF steg[1] = 'salg_vunnet' AND NEW.vunnet_dato IS NOT NULL AND NEW.vunnet_dato < current_date - 7 THEN RETURN NEW; END IF;
    IF steg[1] = 'salg_tapt' AND NEW.tapt_dato IS NOT NULL AND NEW.tapt_dato < current_date - 7 THEN RETURN NEW; END IF;
    PERFORM public.meta_capi_legg_i_ko(k.leadgen_id, k.meta_lead_event_id, k.lead_opprettet_meta,
      steg, 'salgsmulighet_status', k.kilde_lead_id, NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'meta-capi: salgsmulighet kunne ikke legges i kø (%)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_capi_salgsmulighet
AFTER INSERT OR UPDATE OF status, e_post ON public.salgsmuligheter
FOR EACH ROW EXECUTE FUNCTION public.meta_capi_ved_salgsmulighet();

-- 10) Atomic claim with lease and per-claim token.
CREATE OR REPLACE FUNCTION public.meta_capi_claim(
  p_miljo text, p_limit integer DEFAULT 25, p_lease_seconds integer DEFAULT 120, p_id uuid DEFAULT NULL
)
RETURNS SETOF public.meta_capi_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH c AS (
    SELECT e.id
    FROM public.meta_capi_events e
    WHERE e.miljo = p_miljo
      AND (p_id IS NULL OR e.id = p_id)
      AND ((e.status = 'pending' AND e.next_attempt_at <= now())
        OR (e.status = 'processing' AND e.locked_until IS NOT NULL AND e.locked_until < now()))
    ORDER BY e.event_time, e.created_at
    LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.meta_capi_events t
  SET status = 'processing',
      locked_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 600))),
      attempts = t.attempts + 1,
      claim_token = gen_random_uuid(),
      updated_at = now()
  FROM c
  WHERE t.id = c.id
  RETURNING t.*;
END;
$$;

REVOKE ALL ON FUNCTION public.meta_capi_claim(text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_capi_claim(text, integer, integer, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.meta_capi_lead_anker(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_capi_legg_i_ko(text, uuid, timestamptz, text[], text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_capi_ved_import() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_capi_ved_lead_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_capi_ved_salgsmulighet() FROM PUBLIC, anon, authenticated;