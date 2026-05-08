
-- Backfill DealBuilder document IDs and mark as signed
-- Høyen Eiendom AS
UPDATE public.salgsmuligheter SET
  dealbuilder_dokument_id = '9a40b457-1ab9-4594-a98e-87787ada70ff',
  kontrakt_status = 'Signert',
  kontrakt_signert_dato = COALESCE(kontrakt_signert_dato, now()),
  status = 'Vunnet',
  vunnet_dato = COALESCE(vunnet_dato, CURRENT_DATE)
WHERE id = '4d71bff3-9365-49fe-8ded-1cfa7499b35a';

-- Cloudahead AS (deal 'Support agent')
UPDATE public.salgsmuligheter SET
  dealbuilder_dokument_id = 'be8cbf8e-bd11-48b2-8e02-b2fb4f941707',
  kontrakt_status = 'Signert',
  kontrakt_signert_dato = COALESCE(kontrakt_signert_dato, now()),
  status = 'Vunnet',
  vunnet_dato = COALESCE(vunnet_dato, CURRENT_DATE),
  tapt_dato = NULL,
  tapsaarsak = NULL
WHERE id = '649eba42-3c3b-410f-9b4c-8adac6d38fa9';

-- TAFJORD CONNECT AS - find the deal
-- Backfill TAFJORD existing 'Vunnet' deal with the connect-PDF doc id (since Tafjord original was canceled)
-- We'll attach the 'PDF til signering' (Tafjord Connect) doc ed8... — need actual id, look it up
