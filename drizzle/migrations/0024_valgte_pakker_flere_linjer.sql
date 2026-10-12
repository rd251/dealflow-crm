ALTER TABLE public.salgsmuligheter ADD COLUMN valgte_pakker jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.salgsmuligheter.valgte_pakker IS 'Flere valgte pakker/moduler: [{pakke, pris, minutter}]. valgt_pakke beholdes som oppsummering for eldre integrasjoner.';

UPDATE public.salgsmuligheter
SET valgte_pakker = jsonb_build_array(jsonb_build_object('pakke', valgt_pakke, 'pris', COALESCE(forventet_mrr, 0), 'minutter', ''))
WHERE valgt_pakke IS NOT NULL AND valgt_pakke <> '' AND valgte_pakker = '[]'::jsonb;