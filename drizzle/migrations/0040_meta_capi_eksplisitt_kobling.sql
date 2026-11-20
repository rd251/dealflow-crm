-- 1) Explicit lead -> sales opportunity relation, written at the actual conversion.
ALTER TABLE public.salgsmuligheter
  ADD COLUMN IF NOT EXISTS kilde_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS salgsmuligheter_kilde_lead_idx ON public.salgsmuligheter (kilde_lead_id);
COMMENT ON COLUMN public.salgsmuligheter.kilde_lead_id IS 'Lead this opportunity was converted from. Set at conversion (UI, AI, meeting trigger); never guessed or backfilled.';

-- 2) Lineage methods: explicit conversion or a documented activity (older records). No e-mail matching.
ALTER TABLE public.meta_capi_koblinger DROP CONSTRAINT IF EXISTS meta_capi_koblinger_metode_check;
ALTER TABLE public.meta_capi_koblinger ADD CONSTRAINT meta_capi_koblinger_metode_check
  CHECK (metode IN ('import','konvertering','aktivitet'));

-- 3) Stage mapping: exact Meta signals for three stages, own CRM names for the rest.
CREATE OR REPLACE FUNCTION public.meta_capi_steg(p_type text, p_status text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_type
    WHEN 'lead' THEN CASE p_status
      WHEN 'Ny' THEN ARRAY['lead_ny','LEADS']
      WHEN 'Kontaktet' THEN ARRAY['lead_kontaktet','Lead: Kontaktet']
      WHEN 'Svarte ikke telefon' THEN ARRAY['lead_svarte_ikke','Lead: Svarte ikke telefon']
      WHEN 'Kvalifisert' THEN ARRAY['lead_kvalifisert','QUALIFIED']
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
      WHEN 'Vunnet' THEN ARRAY['salg_vunnet','CONVERTED']
      WHEN 'Tapt' THEN ARRAY['salg_tapt','Salgsmulighet: Tapt']
      ELSE NULL END
    ELSE NULL END
$$;

-- 4) Stable lineage for a sales opportunity: explicit kilde_lead_id first; older records only via
--    activities that link the opportunity to exactly one Meta lead. Set once, never rewritten.
CREATE OR REPLACE FUNCTION public.meta_capi_sm_kobling(p_sm public.salgsmuligheter)
RETURNS public.meta_capi_koblinger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  k public.meta_capi_koblinger;
  a public.meta_capi_koblinger;
  v_lead uuid;
  v_leads uuid[];
  v_metode text;
BEGIN
  SELECT * INTO k FROM public.meta_capi_koblinger WHERE salgsmulighet_id = p_sm.id;
  IF k.id IS NOT NULL THEN RETURN k; END IF;

  IF p_sm.kilde_lead_id IS NOT NULL THEN
    v_lead := p_sm.kilde_lead_id;
    v_metode := 'konvertering';
  ELSIF p_sm.created_at < timestamptz '2026-11-20 01:00:00+00' THEN
    SELECT array_agg(DISTINCT ak.lead_id) INTO v_leads
    FROM public.aktiviteter ak
    WHERE ak.salgsmulighet_id = p_sm.id
      AND ak.lead_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.meta_lead_events e WHERE e.lead_id = ak.lead_id AND e.status = 'done');
    IF coalesce(cardinality(v_leads), 0) = 1 THEN
      v_lead := v_leads[1];
      v_metode := 'aktivitet';
    END IF;
  END IF;
  IF v_lead IS NULL THEN RETURN NULL; END IF;

  -- A partner conversion is never a sale.
  IF EXISTS (SELECT 1 FROM public.leads l WHERE l.id = v_lead AND l.status::text = 'Konvertert til partner') THEN
    RETURN NULL;
  END IF;

  a := public.meta_capi_lead_anker(v_lead);
  IF a.id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.meta_capi_koblinger (salgsmulighet_id, kilde_lead_id, meta_lead_event_id, leadgen_id, lead_opprettet_meta, metode)
  VALUES (p_sm.id, v_lead, a.meta_lead_event_id, a.leadgen_id, a.lead_opprettet_meta, v_metode)
  ON CONFLICT DO NOTHING;
  SELECT * INTO k FROM public.meta_capi_koblinger WHERE salgsmulighet_id = p_sm.id;
  RETURN k;
END;
$$;

-- 5) Sales opportunity trigger. The default «Møte booket» on a new row is not a meeting:
--    it is only reported with a linked meeting or when someone actually chooses the stage.
CREATE OR REPLACE FUNCTION public.meta_capi_ved_salgsmulighet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  k public.meta_capi_koblinger;
  steg text[];
BEGIN
  BEGIN
    k := public.meta_capi_sm_kobling(NEW);
    IF k.id IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
    steg := public.meta_capi_steg('salgsmulighet', NEW.status::text);
    IF steg IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'INSERT' AND steg[1] = 'salg_mote_booket' AND NOT EXISTS (
      SELECT 1 FROM public.aktiviteter ak WHERE ak.salgsmulighet_id = NEW.id AND ak.type = 'Møte'
    ) THEN
      RETURN NEW;
    END IF;
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

DROP TRIGGER IF EXISTS trg_meta_capi_salgsmulighet ON public.salgsmuligheter;
CREATE TRIGGER trg_meta_capi_salgsmulighet
AFTER INSERT OR UPDATE OF status, kilde_lead_id ON public.salgsmuligheter
FOR EACH ROW EXECUTE FUNCTION public.meta_capi_ved_salgsmulighet();

-- 6) Meeting evidence: a real meeting linked to an opportunity still in «Møte booket».
CREATE OR REPLACE FUNCTION public.meta_capi_ved_moete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sm public.salgsmuligheter;
  k public.meta_capi_koblinger;
BEGIN
  IF NEW.type::text <> 'Møte' OR NEW.salgsmulighet_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.salgsmulighet_id IS NOT DISTINCT FROM NEW.salgsmulighet_id
     AND OLD.type IS NOT DISTINCT FROM NEW.type THEN RETURN NEW; END IF;
  BEGIN
    SELECT * INTO sm FROM public.salgsmuligheter WHERE id = NEW.salgsmulighet_id;
    IF sm.id IS NULL OR sm.status::text IS DISTINCT FROM 'Møte booket' THEN RETURN NEW; END IF;
    k := public.meta_capi_sm_kobling(sm);
    IF k.id IS NULL THEN RETURN NEW; END IF;
    PERFORM public.meta_capi_legg_i_ko(k.leadgen_id, k.meta_lead_event_id, k.lead_opprettet_meta,
      public.meta_capi_steg('salgsmulighet', 'Møte booket'), 'moete', k.kilde_lead_id, sm.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'meta-capi: møte kunne ikke legges i kø (%)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_capi_moete ON public.aktiviteter;
CREATE TRIGGER trg_meta_capi_moete
AFTER INSERT OR UPDATE OF salgsmulighet_id, type ON public.aktiviteter
FOR EACH ROW EXECUTE FUNCTION public.meta_capi_ved_moete();

-- 7) Meeting trigger conversion stores the explicit lead relation.
CREATE OR REPLACE FUNCTION public.opprett_sm_fra_moete(_moete_id uuid, _firmanavn text, _kontaktperson text, _epost text, _telefon text, _rolle text, _use_case text, _neste_steg text, _notater text, _ansvarlig text, _lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moete aktiviteter%ROWTYPE; v_selskap uuid; v_kontakt uuid; v_sm uuid; v_notat text;
BEGIN
  SELECT * INTO v_moete FROM aktiviteter WHERE id = _moete_id;
  SELECT id INTO v_selskap FROM selskaper WHERE lower(firmanavn) = lower(coalesce(_firmanavn,'')) LIMIT 1;
  IF v_selskap IS NULL THEN
    INSERT INTO selskaper (firmanavn, kundeansvarlig, kundestatus, live_status, onboarding_status, mrr, arr, oppstartskostnad, kundetilstand, sist_aktivitet, neste_steg, notater, kilde, domene, orgnr, firmaadresse, postadresse)
    VALUES (coalesce(nullif(_firmanavn,''),'Ukjent'), _ansvarlig, 'Ikke kunde', false, 'Ikke startet', 0, 0, 0, 'Bra', current_date, '', '', 'Direkte salg',
            CASE WHEN _epost LIKE '%@%' THEN split_part(lower(_epost),'@',2) ELSE '' END, '', '', '')
    RETURNING id INTO v_selskap;
  END IF;
  IF coalesce(_epost,'') <> '' THEN
    SELECT id INTO v_kontakt FROM kontakter WHERE lower(e_post) = lower(_epost) LIMIT 1;
  END IF;
  IF v_kontakt IS NULL AND coalesce(_kontaktperson,'') <> '' THEN
    INSERT INTO kontakter (selskap_id, navn, e_post, telefon, rolle, linkedin, notater)
    VALUES (v_selskap, _kontaktperson, nullif(_epost,''), nullif(_telefon,''), coalesce(_rolle,''), '', '')
    RETURNING id INTO v_kontakt;
  END IF;
  v_notat := 'Opprettet automatisk fra møte ' || coalesce(nullif(v_moete.tittel,''),'uten tittel') || ' ' ||
             to_char(v_moete.dato AT TIME ZONE 'Europe/Oslo', 'DD.MM.YYYY');
  INSERT INTO salgsmuligheter (navn, selskap_id, kontakt_id, ansvarlig, status, forventet_mrr, sla, oppstartskostnad, kontraktslengde_mnd, sannsynlighet,
    neste_steg, notater, opprettet_dato, sist_aktivitet, kilde, partner_provisjon, partner_kostnad, netto_inntekt,
    rolle_i_firma, use_case, kontaktperson, e_post, telefon, kontrakt_status, valgt_pakke, valgte_pakker, kilde_lead_id)
  VALUES (coalesce(nullif(_use_case,''), nullif(_firmanavn,''), 'Salgsmulighet'), v_selskap, v_kontakt, _ansvarlig, 'Møte booket', 0, 0, 0, 12, 50,
    coalesce(_neste_steg,''), v_notat || CASE WHEN coalesce(_notater,'') <> '' THEN E'\n\n' || _notater ELSE '' END,
    current_date, current_date, 'Direkte salg', 0, 0, 0,
    coalesce(_rolle,''), coalesce(_use_case,''), coalesce(_kontaktperson,''), coalesce(_epost,''), coalesce(_telefon,''), 'Ikke sendt', '', '[]'::jsonb, _lead_id)
  RETURNING id INTO v_sm;

  INSERT INTO oppgaver (oppgave, salgsmulighet_id, ansvarlig, frist, prioritet, status, paaminnelse, notater)
  VALUES ('Gjennomfør demo', v_sm, _ansvarlig, current_date + 7, 'Høy', 'Åpen', true, '');

  UPDATE aktiviteter SET salgsmulighet_id = v_sm, selskap_id = coalesce(selskap_id, v_selskap)
  WHERE id = _moete_id OR (_lead_id IS NOT NULL AND lead_id = _lead_id AND salgsmulighet_id IS NULL);
  RETURN v_sm;
END $function$;

REVOKE ALL ON FUNCTION public.meta_capi_sm_kobling(public.salgsmuligheter) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_capi_ved_salgsmulighet() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_capi_ved_moete() FROM PUBLIC, anon, authenticated;