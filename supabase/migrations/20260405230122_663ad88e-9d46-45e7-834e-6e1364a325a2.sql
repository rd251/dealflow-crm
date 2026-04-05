
ALTER TABLE public.ringeliste
  ADD COLUMN segment text DEFAULT '' NOT NULL,
  ADD COLUMN kanal text DEFAULT '' NOT NULL,
  ADD COLUMN partnertype_segment text DEFAULT '' NOT NULL,
  ADD COLUMN kilde_segment text DEFAULT '' NOT NULL;
