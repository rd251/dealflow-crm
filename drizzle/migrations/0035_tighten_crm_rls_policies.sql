-- Erstatt «true»-regler med faktiske tilgangssjekker: interne ansatte leser alt, kun ikke-lesebrukere (ikke viewer) kan endre.
CREATE OR REPLACE FUNCTION public.kan_redigere_crm(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.er_intern(_user_id) AND NOT public.has_role(_user_id, 'viewer')
$$;

ALTER POLICY "Authenticated delete aktiviteter" ON public.aktiviteter USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert aktiviteter" ON public.aktiviteter WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read aktiviteter" ON public.aktiviteter USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update aktiviteter" ON public.aktiviteter USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can read app settings" ON public.app_settings USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated delete kontakter" ON public.kontakter USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert kontakter" ON public.kontakter WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read kontakter" ON public.kontakter USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update kontakter" ON public.kontakter USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete leads" ON public.leads USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert leads" ON public.leads WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read leads" ON public.leads USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update leads" ON public.leads USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can delete nyhetsbrev" ON public.nyhetsbrev USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can insert nyhetsbrev" ON public.nyhetsbrev WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can view nyhetsbrev" ON public.nyhetsbrev USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated can update nyhetsbrev" ON public.nyhetsbrev USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can delete avmeldte" ON public.nyhetsbrev_avmeldte USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can insert avmeldte" ON public.nyhetsbrev_avmeldte WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can view avmeldte" ON public.nyhetsbrev_avmeldte USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated can delete mottakere" ON public.nyhetsbrev_mottakere USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can insert mottakere" ON public.nyhetsbrev_mottakere WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can view mottakere" ON public.nyhetsbrev_mottakere USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated can update mottakere" ON public.nyhetsbrev_mottakere USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete oppgaver" ON public.oppgaver USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert oppgaver" ON public.oppgaver WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read oppgaver" ON public.oppgaver USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update oppgaver" ON public.oppgaver USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can delete partner_pakker" ON public.partner_pakker USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can insert partner_pakker" ON public.partner_pakker WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can view partner_pakker" ON public.partner_pakker USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated can update partner_pakker" ON public.partner_pakker USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can delete partner_prismodell" ON public.partner_prismodell USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can insert partner_prismodell" ON public.partner_prismodell WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated can view partner_prismodell" ON public.partner_prismodell USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated can update partner_prismodell" ON public.partner_prismodell USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete partnere" ON public.partnere USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert partnere" ON public.partnere WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read partnere" ON public.partnere USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update partnere" ON public.partnere USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete prosjekter" ON public.prosjekter USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert prosjekter" ON public.prosjekter WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read prosjekter" ON public.prosjekter USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update prosjekter" ON public.prosjekter USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete ringeliste" ON public.ringeliste USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert ringeliste" ON public.ringeliste WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read ringeliste" ON public.ringeliste USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update ringeliste" ON public.ringeliste USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete ringelister" ON public.ringelister USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert ringelister" ON public.ringelister WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read ringelister" ON public.ringelister USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update ringelister" ON public.ringelister USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete salgsmuligheter" ON public.salgsmuligheter USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert salgsmuligheter" ON public.salgsmuligheter WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read salgsmuligheter" ON public.salgsmuligheter USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update salgsmuligheter" ON public.salgsmuligheter USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated users can delete company documents" ON public.selskap_dokumenter USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated users can insert company documents" ON public.selskap_dokumenter WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated users can view company documents" ON public.selskap_dokumenter USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated insert selskap_innsikt" ON public.selskap_innsikt WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read selskap_innsikt" ON public.selskap_innsikt USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update selskap_innsikt" ON public.selskap_innsikt USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated delete selskaper" ON public.selskaper USING (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated insert selskaper" ON public.selskaper WITH CHECK (public.kan_redigere_crm(auth.uid()));
ALTER POLICY "Authenticated read selskaper" ON public.selskaper USING (public.er_intern(auth.uid()));
ALTER POLICY "Authenticated update selskaper" ON public.selskaper USING (public.kan_redigere_crm(auth.uid())) WITH CHECK (public.kan_redigere_crm(auth.uid()));
