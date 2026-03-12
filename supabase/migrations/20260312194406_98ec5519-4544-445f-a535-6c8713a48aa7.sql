
-- Drop existing authenticated-only policies and recreate with public access

-- LEADS
DROP POLICY IF EXISTS "Auth read leads" ON public.leads;
DROP POLICY IF EXISTS "Auth insert leads" ON public.leads;
DROP POLICY IF EXISTS "Auth update leads" ON public.leads;
DROP POLICY IF EXISTS "Auth delete leads" ON public.leads;
CREATE POLICY "Public read leads" ON public.leads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update leads" ON public.leads FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete leads" ON public.leads FOR DELETE TO anon, authenticated USING (true);

-- SELSKAPER
DROP POLICY IF EXISTS "Auth read selskaper" ON public.selskaper;
DROP POLICY IF EXISTS "Auth insert selskaper" ON public.selskaper;
DROP POLICY IF EXISTS "Auth update selskaper" ON public.selskaper;
DROP POLICY IF EXISTS "Auth delete selskaper" ON public.selskaper;
CREATE POLICY "Public read selskaper" ON public.selskaper FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert selskaper" ON public.selskaper FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update selskaper" ON public.selskaper FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete selskaper" ON public.selskaper FOR DELETE TO anon, authenticated USING (true);

-- SALGSMULIGHETER
DROP POLICY IF EXISTS "Auth read salgsmuligheter" ON public.salgsmuligheter;
DROP POLICY IF EXISTS "Auth insert salgsmuligheter" ON public.salgsmuligheter;
DROP POLICY IF EXISTS "Auth update salgsmuligheter" ON public.salgsmuligheter;
DROP POLICY IF EXISTS "Auth delete salgsmuligheter" ON public.salgsmuligheter;
CREATE POLICY "Public read salgsmuligheter" ON public.salgsmuligheter FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert salgsmuligheter" ON public.salgsmuligheter FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update salgsmuligheter" ON public.salgsmuligheter FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete salgsmuligheter" ON public.salgsmuligheter FOR DELETE TO anon, authenticated USING (true);

-- KONTAKTER
DROP POLICY IF EXISTS "Auth read kontakter" ON public.kontakter;
DROP POLICY IF EXISTS "Auth insert kontakter" ON public.kontakter;
DROP POLICY IF EXISTS "Auth update kontakter" ON public.kontakter;
DROP POLICY IF EXISTS "Auth delete kontakter" ON public.kontakter;
CREATE POLICY "Public read kontakter" ON public.kontakter FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert kontakter" ON public.kontakter FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update kontakter" ON public.kontakter FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete kontakter" ON public.kontakter FOR DELETE TO anon, authenticated USING (true);

-- PROSJEKTER
DROP POLICY IF EXISTS "Auth read prosjekter" ON public.prosjekter;
DROP POLICY IF EXISTS "Auth insert prosjekter" ON public.prosjekter;
DROP POLICY IF EXISTS "Auth update prosjekter" ON public.prosjekter;
DROP POLICY IF EXISTS "Auth delete prosjekter" ON public.prosjekter;
CREATE POLICY "Public read prosjekter" ON public.prosjekter FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert prosjekter" ON public.prosjekter FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update prosjekter" ON public.prosjekter FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete prosjekter" ON public.prosjekter FOR DELETE TO anon, authenticated USING (true);

-- PARTNERE
DROP POLICY IF EXISTS "Auth read partnere" ON public.partnere;
DROP POLICY IF EXISTS "Auth insert partnere" ON public.partnere;
DROP POLICY IF EXISTS "Auth update partnere" ON public.partnere;
DROP POLICY IF EXISTS "Auth delete partnere" ON public.partnere;
CREATE POLICY "Public read partnere" ON public.partnere FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert partnere" ON public.partnere FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update partnere" ON public.partnere FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete partnere" ON public.partnere FOR DELETE TO anon, authenticated USING (true);

-- OPPGAVER
DROP POLICY IF EXISTS "Users read own tasks" ON public.oppgaver;
DROP POLICY IF EXISTS "Users insert own tasks" ON public.oppgaver;
DROP POLICY IF EXISTS "Users update own tasks" ON public.oppgaver;
DROP POLICY IF EXISTS "Users delete own tasks" ON public.oppgaver;
CREATE POLICY "Public read oppgaver" ON public.oppgaver FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert oppgaver" ON public.oppgaver FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update oppgaver" ON public.oppgaver FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Public delete oppgaver" ON public.oppgaver FOR DELETE TO anon, authenticated USING (true);
