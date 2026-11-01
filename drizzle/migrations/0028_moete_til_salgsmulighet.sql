ALTER TABLE public.aktiviteter ADD COLUMN IF NOT EXISTS eksterne_deltakere text[] NOT NULL DEFAULT '{}';

-- Felles hjelper: oppretter selskap/kontakt/salgsmulighet + demo-oppgave og kobler aktiviteter.
CREATE OR REPLACE FUNCTION public.opprett_sm_fra_moete(
  _moete_id uuid, _firmanavn text, _kontaktperson text, _epost text, _telefon text,
  _rolle text, _use_case text, _neste_steg text, _notater text, _ansvarlig text, _lead_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    rolle_i_firma, use_case, kontaktperson, e_post, telefon, kontrakt_status, valgt_pakke, valgte_pakker)
  VALUES (coalesce(nullif(_use_case,''), nullif(_firmanavn,''), 'Salgsmulighet'), v_selskap, v_kontakt, _ansvarlig, 'Møte booket', 0, 0, 0, 12, 50,
    coalesce(_neste_steg,''), v_notat || CASE WHEN coalesce(_notater,'') <> '' THEN E'\n\n' || _notater ELSE '' END,
    current_date, current_date, 'Direkte salg', 0, 0, 0,
    coalesce(_rolle,''), coalesce(_use_case,''), coalesce(_kontaktperson,''), coalesce(_epost,''), coalesce(_telefon,''), 'Ikke sendt', '', '[]'::jsonb)
  RETURNING id INTO v_sm;

  INSERT INTO oppgaver (oppgave, salgsmulighet_id, ansvarlig, frist, prioritet, status, paaminnelse, notater)
  VALUES ('Gjennomfør demo', v_sm, _ansvarlig, current_date + 7, 'Høy', 'Åpen', true, '');

  UPDATE aktiviteter SET salgsmulighet_id = v_sm, selskap_id = coalesce(selskap_id, v_selskap)
  WHERE id = _moete_id OR (_lead_id IS NOT NULL AND lead_id = _lead_id AND salgsmulighet_id IS NULL);
  RETURN v_sm;
END $$;
REVOKE ALL ON FUNCTION public.opprett_sm_fra_moete(uuid,text,text,text,text,text,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.moete_til_salgsmulighet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eksterne text[]; v_lead leads%ROWTYPE; v_sm uuid;
  v_generisk text[] := ARRAY['gmail.com','hotmail.com','outlook.com','yahoo.com','live.com','icloud.com','me.com','msn.com','aol.com','protonmail.com','proton.me','online.no','hotmail.no'];
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.type::text <> 'Møte' OR NEW.salgsmulighet_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT coalesce(array_agg(DISTINCT lower(trim(e))), '{}') INTO v_eksterne
  FROM unnest(coalesce(NEW.eksterne_deltakere, '{}')) e
  WHERE e LIKE '%@%' AND lower(trim(e)) NOT LIKE '%@snakk.ai';

  IF NEW.lead_id IS NOT NULL THEN
    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;
  ELSIF cardinality(v_eksterne) = 0 THEN
    RETURN NEW; -- internt møte / ingen eksterne
  ELSE
    SELECT * INTO v_lead FROM leads l WHERE lower(l.e_post) = ANY(v_eksterne)
      ORDER BY (l.status::text IN ('Konvertert til salg','Konvertert til partner','Ikke aktuelt')), l.updated_at DESC LIMIT 1;
    IF v_lead.id IS NULL THEN
      SELECT * INTO v_lead FROM leads l
      WHERE split_part(lower(l.e_post),'@',2) <> '' AND NOT (split_part(lower(l.e_post),'@',2) = ANY(v_generisk))
        AND split_part(lower(l.e_post),'@',2) IN (SELECT split_part(x,'@',2) FROM unnest(v_eksterne) x)
      ORDER BY (l.status::text IN ('Konvertert til salg','Konvertert til partner','Ikke aktuelt')), l.updated_at DESC LIMIT 1;
    END IF;
  END IF;
  IF v_lead.id IS NULL OR v_lead.status::text IN ('Ikke aktuelt','Konvertert til partner') THEN RETURN NEW; END IF;

  -- Åpen salgsmulighet finnes allerede → kun kobling
  SELECT s.id INTO v_sm FROM salgsmuligheter s
  LEFT JOIN kontakter k ON k.id = s.kontakt_id
  WHERE s.status::text NOT IN ('Vunnet','Tapt')
    AND coalesce(v_lead.e_post,'') <> ''
    AND (lower(s.e_post) = lower(v_lead.e_post) OR lower(k.e_post) = lower(v_lead.e_post))
  ORDER BY s.updated_at DESC LIMIT 1;
  IF v_sm IS NOT NULL THEN
    UPDATE aktiviteter SET salgsmulighet_id = v_sm,
      selskap_id = coalesce(selskap_id, (SELECT selskap_id FROM salgsmuligheter WHERE id = v_sm))
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  IF v_lead.status::text = 'Konvertert til salg' OR v_lead.konvertert_dato IS NOT NULL THEN RETURN NEW; END IF;

  PERFORM opprett_sm_fra_moete(NEW.id, v_lead.firmanavn, v_lead.kontaktperson, v_lead.e_post, v_lead.telefon,
    v_lead.rolle_i_firma, v_lead.use_case, v_lead.neste_steg, v_lead.notater,
    coalesce(NEW.user_id::text, nullif(v_lead.ansvarlig,''), ''), v_lead.id);
  UPDATE leads SET status = 'Konvertert til salg', konvertert_dato = current_date, neste_oppfolging = NULL, sist_aktivitet = current_date
  WHERE id = v_lead.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.moete_til_salgsmulighet() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_moete_til_salgsmulighet ON public.aktiviteter;
CREATE TRIGGER trg_moete_til_salgsmulighet
AFTER INSERT OR UPDATE OF lead_id, eksterne_deltakere, salgsmulighet_id ON public.aktiviteter
FOR EACH ROW WHEN (NEW.type::text = 'Møte') EXECUTE FUNCTION public.moete_til_salgsmulighet();

-- Manuelt fra Innboks-forslag: møte med ekstern deltaker uten kobling
CREATE OR REPLACE FUNCTION public.moete_forslag_til_salgsmulighet(_moete_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_moete aktiviteter%ROWTYPE; v_epost text; v_domene text;
BEGIN
  IF NOT public.er_intern(auth.uid()) OR public.has_role(auth.uid(), 'viewer') THEN RAISE EXCEPTION 'Ingen tilgang'; END IF;
  SELECT * INTO v_moete FROM aktiviteter WHERE id = _moete_id AND type::text = 'Møte';
  IF v_moete.id IS NULL THEN RAISE EXCEPTION 'Fant ikke møtet'; END IF;
  IF v_moete.salgsmulighet_id IS NOT NULL THEN RETURN v_moete.salgsmulighet_id; END IF;
  SELECT lower(e) INTO v_epost FROM unnest(v_moete.eksterne_deltakere) e WHERE lower(e) NOT LIKE '%@snakk.ai' LIMIT 1;
  IF v_epost IS NULL THEN RAISE EXCEPTION 'Møtet har ingen ekstern deltaker'; END IF;
  v_domene := split_part(v_epost,'@',2);
  RETURN opprett_sm_fra_moete(_moete_id, initcap(split_part(v_domene,'.',1)), split_part(v_epost,'@',1), v_epost, '', '', '', '', '',
    coalesce(v_moete.user_id::text, auth.uid()::text), NULL);
END $$;
REVOKE ALL ON FUNCTION public.moete_forslag_til_salgsmulighet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moete_forslag_til_salgsmulighet(uuid) TO authenticated;