CREATE OR REPLACE FUNCTION public.moete_til_salgsmulighet_kjor(new aktiviteter)
 RETURNS aktiviteter LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_eksterne text[]; v_lead leads%ROWTYPE; v_sm uuid; v_dom text; v_navn text; v_ansv text;
  v_kunde uuid; v_partner uuid; v_partner_selskap uuid;
  v_generisk text[] := ARRAY['gmail.com','hotmail.com','outlook.com','yahoo.com','live.com','icloud.com','me.com','msn.com','aol.com','protonmail.com','proton.me','online.no','hotmail.no'];
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.type::text <> 'Møte' OR NEW.salgsmulighet_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT coalesce(array_agg(DISTINCT lower(trim(e))), '{}') INTO v_eksterne
  FROM unnest(coalesce(NEW.eksterne_deltakere, '{}')) e
  WHERE e LIKE '%@%' AND lower(trim(e)) NOT LIKE '%@snakk.ai';
  IF NEW.lead_id IS NOT NULL THEN
    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;
  ELSIF cardinality(v_eksterne) = 0 THEN
    RETURN NEW;
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

  -- Eksisterende kunde eller partner → bare koble møtet, ikke konverter.
  v_dom := nullif(split_part(lower(coalesce(v_lead.e_post,'')),'@',2), '');
  IF v_dom = ANY(v_generisk) THEN v_dom := NULL; END IF;
  SELECT s.id INTO v_kunde FROM selskaper s
  WHERE ((v_dom IS NOT NULL AND lower(nullif(s.domene,'')) = v_dom)
      OR (nullif(trim(v_lead.firmanavn),'') IS NOT NULL AND lower(s.firmanavn) = lower(trim(v_lead.firmanavn))))
    AND (s.kundestatus::text IN ('Live','Pilot')
      OR EXISTS (SELECT 1 FROM salgsmuligheter sm WHERE sm.selskap_id = s.id AND sm.status::text = 'Vunnet'))
  LIMIT 1;
  SELECT p.id, p.selskap_id INTO v_partner, v_partner_selskap FROM partnere p
  LEFT JOIN selskaper ps ON ps.id = p.selskap_id
  WHERE (v_dom IS NOT NULL AND (split_part(lower(coalesce(p.e_post,'')),'@',2) = v_dom OR lower(nullif(ps.domene,'')) = v_dom))
     OR (nullif(trim(v_lead.firmanavn),'') IS NOT NULL AND (lower(p.partnernavn) = lower(trim(v_lead.firmanavn)) OR lower(ps.firmanavn) = lower(trim(v_lead.firmanavn))))
  LIMIT 1;
  IF v_kunde IS NOT NULL OR v_partner IS NOT NULL THEN
    UPDATE aktiviteter SET selskap_id = coalesce(selskap_id, v_kunde, v_partner_selskap),
      partner_id = coalesce(partner_id, v_partner)
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_navn := coalesce(nullif(trim(v_lead.firmanavn),''), nullif(trim(v_lead.kontaktperson),''),
                     nullif(split_part(lower(coalesce(v_lead.e_post,'')),'@',2),''), 'Ukjent');
  v_ansv := coalesce(NEW.user_id::text, nullif(v_lead.ansvarlig,''), v_lead.eier_id::text, '');
  PERFORM opprett_sm_fra_moete(NEW.id, v_navn, v_lead.kontaktperson, v_lead.e_post, v_lead.telefon,
    v_lead.rolle_i_firma, v_lead.use_case, v_lead.neste_steg, v_lead.notater, v_ansv, v_lead.id);
  UPDATE leads SET status = 'Konvertert til salg', konvertert_dato = current_date, neste_oppfolging = NULL, sist_aktivitet = current_date
  WHERE id = v_lead.id;
  RETURN NEW;
END $function$;