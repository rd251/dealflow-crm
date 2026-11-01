CREATE OR REPLACE FUNCTION public.moete_til_salgsmulighet_vakt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Når et møte kobles fra en salgsmulighet (f.eks. ved sletting) skal det ikke kobles på igjen.
  IF TG_OP = 'UPDATE' AND OLD.salgsmulighet_id IS NOT NULL THEN RETURN NEW; END IF;
  RETURN public.moete_til_salgsmulighet_kjor(NEW);
END $$;

CREATE OR REPLACE FUNCTION public.moete_til_salgsmulighet_kjor(NEW public.aktiviteter)
RETURNS public.aktiviteter LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  PERFORM opprett_sm_fra_moete(NEW.id, v_lead.firmanavn, v_lead.kontaktperson, v_lead.e_post, v_lead.telefon,
    v_lead.rolle_i_firma, v_lead.use_case, v_lead.neste_steg, v_lead.notater,
    coalesce(NEW.user_id::text, nullif(v_lead.ansvarlig,''), ''), v_lead.id);
  UPDATE leads SET status = 'Konvertert til salg', konvertert_dato = current_date, neste_oppfolging = NULL, sist_aktivitet = current_date
  WHERE id = v_lead.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.moete_til_salgsmulighet_kjor(public.aktiviteter) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.moete_til_salgsmulighet_vakt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_moete_til_salgsmulighet ON public.aktiviteter;
CREATE TRIGGER trg_moete_til_salgsmulighet
AFTER INSERT OR UPDATE OF lead_id, eksterne_deltakere, salgsmulighet_id ON public.aktiviteter
FOR EACH ROW WHEN (NEW.type::text = 'Møte') EXECUTE FUNCTION public.moete_til_salgsmulighet_vakt();
COMMENT ON FUNCTION public.moete_til_salgsmulighet() IS 'DEPRECATED: replaced by moete_til_salgsmulighet_vakt/_kjor';