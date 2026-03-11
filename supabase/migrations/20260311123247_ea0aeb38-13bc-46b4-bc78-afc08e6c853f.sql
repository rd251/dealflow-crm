-- Fix leads RLS: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Auth delete leads" ON public.leads;
DROP POLICY IF EXISTS "Auth insert leads" ON public.leads;
DROP POLICY IF EXISTS "Auth read leads" ON public.leads;
DROP POLICY IF EXISTS "Auth update leads" ON public.leads;

CREATE POLICY "Auth read leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete leads" ON public.leads FOR DELETE TO authenticated USING (true);

-- Fix kontakter
DROP POLICY IF EXISTS "Auth delete kontakter" ON public.kontakter;
DROP POLICY IF EXISTS "Auth insert kontakter" ON public.kontakter;
DROP POLICY IF EXISTS "Auth read kontakter" ON public.kontakter;
DROP POLICY IF EXISTS "Auth update kontakter" ON public.kontakter;

CREATE POLICY "Auth read kontakter" ON public.kontakter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert kontakter" ON public.kontakter FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update kontakter" ON public.kontakter FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete kontakter" ON public.kontakter FOR DELETE TO authenticated USING (true);

-- Fix partnere
DROP POLICY IF EXISTS "Auth delete partnere" ON public.partnere;
DROP POLICY IF EXISTS "Auth insert partnere" ON public.partnere;
DROP POLICY IF EXISTS "Auth read partnere" ON public.partnere;
DROP POLICY IF EXISTS "Auth update partnere" ON public.partnere;

CREATE POLICY "Auth read partnere" ON public.partnere FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert partnere" ON public.partnere FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update partnere" ON public.partnere FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete partnere" ON public.partnere FOR DELETE TO authenticated USING (true);

-- Fix prosjekter
DROP POLICY IF EXISTS "Auth delete prosjekter" ON public.prosjekter;
DROP POLICY IF EXISTS "Auth insert prosjekter" ON public.prosjekter;
DROP POLICY IF EXISTS "Auth read prosjekter" ON public.prosjekter;
DROP POLICY IF EXISTS "Auth update prosjekter" ON public.prosjekter;

CREATE POLICY "Auth read prosjekter" ON public.prosjekter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert prosjekter" ON public.prosjekter FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update prosjekter" ON public.prosjekter FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete prosjekter" ON public.prosjekter FOR DELETE TO authenticated USING (true);

-- Fix salgsmuligheter
DROP POLICY IF EXISTS "Auth delete salgsmuligheter" ON public.salgsmuligheter;
DROP POLICY IF EXISTS "Auth insert salgsmuligheter" ON public.salgsmuligheter;
DROP POLICY IF EXISTS "Auth read salgsmuligheter" ON public.salgsmuligheter;
DROP POLICY IF EXISTS "Auth update salgsmuligheter" ON public.salgsmuligheter;

CREATE POLICY "Auth read salgsmuligheter" ON public.salgsmuligheter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert salgsmuligheter" ON public.salgsmuligheter FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update salgsmuligheter" ON public.salgsmuligheter FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete salgsmuligheter" ON public.salgsmuligheter FOR DELETE TO authenticated USING (true);

-- Fix selskaper
DROP POLICY IF EXISTS "Auth delete selskaper" ON public.selskaper;
DROP POLICY IF EXISTS "Auth insert selskaper" ON public.selskaper;
DROP POLICY IF EXISTS "Auth read selskaper" ON public.selskaper;
DROP POLICY IF EXISTS "Auth update selskaper" ON public.selskaper;

CREATE POLICY "Auth read selskaper" ON public.selskaper FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert selskaper" ON public.selskaper FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update selskaper" ON public.selskaper FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete selskaper" ON public.selskaper FOR DELETE TO authenticated USING (true);

-- Fix oppgaver
DROP POLICY IF EXISTS "Users delete own tasks" ON public.oppgaver;
DROP POLICY IF EXISTS "Users insert own tasks" ON public.oppgaver;
DROP POLICY IF EXISTS "Users read own tasks" ON public.oppgaver;
DROP POLICY IF EXISTS "Users update own tasks" ON public.oppgaver;

CREATE POLICY "Users read own tasks" ON public.oppgaver FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own tasks" ON public.oppgaver FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own tasks" ON public.oppgaver FOR UPDATE TO authenticated USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users delete own tasks" ON public.oppgaver FOR DELETE TO authenticated USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));