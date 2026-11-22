-- Automatisk velkomstmail er slått av: ingen trigger, ingen «venter»-status.
DROP TRIGGER IF EXISTS trg_lead_velkomst ON public.leads;

CREATE OR REPLACE FUNCTION public.lead_velkomst_planlegg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Slått av: setter ikke velkomst_status og planlegger ingen utsending.
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lead_velkomst_planlegg() FROM PUBLIC, anon, authenticated;

-- Møte → salgsmulighet lager ikke lenger oppgaven «Gjennomfør demo».
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

  -- Ingen automatisk oppgave: brukeren oppretter neste oppgave selv.

  UPDATE aktiviteter SET salgsmulighet_id = v_sm, selskap_id = coalesce(selskap_id, v_selskap)
  WHERE id = _moete_id OR (_lead_id IS NOT NULL AND lead_id = _lead_id AND salgsmulighet_id IS NULL);
  RETURN v_sm;
END $function$;