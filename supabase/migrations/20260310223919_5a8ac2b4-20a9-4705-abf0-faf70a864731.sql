
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.lead_status AS ENUM ('Ny', 'Kontaktet', 'Kvalifisert', 'Ikke aktuelt', 'Konvertert til salg', 'Konvertert til partner');
CREATE TYPE public.lead_kilde AS ENUM ('Nettside', 'LinkedIn', 'Partner', 'Referanse', 'Kald outbound', 'E-post', 'Telefon', 'Annet');
CREATE TYPE public.salgsmulighet_status AS ENUM ('Ny mulighet', 'Møte booket', 'Demo gjennomført', 'Tilbud sendt', 'Forhandling', 'Vunnet', 'Tapt');
CREATE TYPE public.tapsaarsak AS ENUM ('Pris', 'Ikke riktig timing', 'Valgte annen leverandør', 'Ikke behov', 'Teknisk / integrasjon', 'Annet');
CREATE TYPE public.prosjekt_status AS ENUM ('Ny', 'I produksjon', 'Test med kunde', 'Live', 'Blokkert');
CREATE TYPE public.integrasjon AS ENUM ('Ingen', 'GastroPlanner', 'HubSpot', 'Lime', 'Salesforce', 'API', 'Annet');
CREATE TYPE public.kundestatus AS ENUM ('Ikke kunde', 'Pilot', 'Live', 'Pause', 'Kansellert');
CREATE TYPE public.onboarding_status AS ENUM ('Ikke startet', 'Pågår', 'Venter på kunde', 'Klar for live', 'Ferdig');
CREATE TYPE public.kundetilstand AS ENUM ('Bra', 'Usikker', 'Risiko');
CREATE TYPE public.kanselleringsaarsak AS ENUM ('Pris', 'Lav bruk', 'Teknisk utfordring', 'Manglende verdi', 'Byttet leverandør', 'Midlertidig stopp', 'Annet');
CREATE TYPE public.oppgave_status AS ENUM ('Åpen', 'Pågår', 'Ferdig');
CREATE TYPE public.prioritet AS ENUM ('Lav', 'Medium', 'Høy');
CREATE TYPE public.partnertype AS ENUM ('Provisjonspartner', 'Integrasjonspartner', 'Salgspartner', 'Strategisk partner');
CREATE TYPE public.partnerstatus AS ENUM ('Aktiv', 'Under onboarding', 'Inaktiv');
CREATE TYPE public.partner_pipeline_status AS ENUM ('Ny partner', 'Introduksjon', 'Demo / gjennomgang', 'Avtale', 'Aktiv partner');
CREATE TYPE public.provisjonstype AS ENUM ('Engangsprovisjon', 'Løpende provisjon', 'Hybrid');
CREATE TYPE public.kilde AS ENUM ('Direkte salg', 'Partner', 'Inbound', 'Outbound');

-- ============ HELPER FUNCTION ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ SELSKAPER ============
CREATE TABLE public.selskaper (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firmanavn TEXT NOT NULL,
  bransje TEXT DEFAULT '',
  kundeansvarlig TEXT DEFAULT '',
  kundestatus kundestatus NOT NULL DEFAULT 'Ikke kunde',
  live_status BOOLEAN DEFAULT false,
  onboarding_status onboarding_status DEFAULT 'Ikke startet',
  mrr NUMERIC DEFAULT 0,
  arr NUMERIC DEFAULT 0,
  oppstartskostnad NUMERIC DEFAULT 0,
  go_live_dato DATE,
  kansellert_dato DATE,
  kanselleringsaarsak kanselleringsaarsak,
  kanselleringsnotat TEXT DEFAULT '',
  kundetilstand kundetilstand DEFAULT 'Bra',
  sist_aktivitet DATE DEFAULT CURRENT_DATE,
  neste_steg TEXT DEFAULT '',
  notater TEXT DEFAULT '',
  kilde kilde DEFAULT 'Direkte salg',
  partner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.selskaper ENABLE ROW LEVEL SECURITY;

-- ============ KONTAKTER ============
CREATE TABLE public.kontakter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selskap_id UUID REFERENCES public.selskaper(id) ON DELETE SET NULL,
  navn TEXT NOT NULL,
  rolle TEXT DEFAULT '',
  e_post TEXT DEFAULT '',
  telefon TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  notater TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kontakter ENABLE ROW LEVEL SECURITY;

-- ============ LEADS ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firmanavn TEXT NOT NULL,
  kontaktperson TEXT DEFAULT '',
  e_post TEXT DEFAULT '',
  telefon TEXT DEFAULT '',
  kilde lead_kilde DEFAULT 'Annet',
  status lead_status DEFAULT 'Ny',
  ansvarlig TEXT DEFAULT '',
  neste_steg TEXT DEFAULT '',
  notater TEXT DEFAULT '',
  opprettet_dato DATE DEFAULT CURRENT_DATE,
  sist_aktivitet DATE DEFAULT CURRENT_DATE,
  konvertert_dato DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ============ PARTNERE ============
CREATE TABLE public.partnere (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnernavn TEXT NOT NULL,
  partnertype partnertype DEFAULT 'Salgspartner',
  kontaktperson TEXT DEFAULT '',
  e_post TEXT DEFAULT '',
  telefon TEXT DEFAULT '',
  partnerstatus partnerstatus DEFAULT 'Under onboarding',
  pipeline_status partner_pipeline_status DEFAULT 'Ny partner',
  ansvarlig TEXT DEFAULT '',
  provisjonsprosent NUMERIC DEFAULT 0,
  provisjonstype provisjonstype,
  selskap_id UUID REFERENCES public.selskaper(id) ON DELETE SET NULL,
  opprettet_dato DATE DEFAULT CURRENT_DATE,
  sist_aktivitet DATE DEFAULT CURRENT_DATE,
  notater TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partnere ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.selskaper ADD CONSTRAINT fk_selskaper_partner FOREIGN KEY (partner_id) REFERENCES public.partnere(id) ON DELETE SET NULL;

-- ============ SALGSMULIGHETER ============
CREATE TABLE public.salgsmuligheter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navn TEXT NOT NULL,
  selskap_id UUID REFERENCES public.selskaper(id) ON DELETE SET NULL,
  kontakt_id UUID REFERENCES public.kontakter(id) ON DELETE SET NULL,
  ansvarlig TEXT DEFAULT '',
  status salgsmulighet_status DEFAULT 'Ny mulighet',
  forventet_mrr NUMERIC DEFAULT 0,
  sla NUMERIC DEFAULT 0,
  oppstartskostnad NUMERIC DEFAULT 0,
  kontraktslengde_mnd INT DEFAULT 12,
  sannsynlighet INT DEFAULT 50,
  forventet_lukkedato DATE,
  vunnet_dato DATE,
  tapt_dato DATE,
  tapsaarsak tapsaarsak,
  neste_steg TEXT DEFAULT '',
  notater TEXT DEFAULT '',
  opprettet_dato DATE DEFAULT CURRENT_DATE,
  sist_aktivitet DATE DEFAULT CURRENT_DATE,
  kilde kilde DEFAULT 'Direkte salg',
  partner_id UUID REFERENCES public.partnere(id) ON DELETE SET NULL,
  partner_provisjon NUMERIC DEFAULT 0,
  partner_kostnad NUMERIC DEFAULT 0,
  netto_inntekt NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.salgsmuligheter ENABLE ROW LEVEL SECURITY;

-- ============ PROSJEKTER ============
CREATE TABLE public.prosjekter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prosjektnavn TEXT NOT NULL,
  selskap_id UUID REFERENCES public.selskaper(id) ON DELETE SET NULL,
  salgsmulighet_id UUID REFERENCES public.salgsmuligheter(id) ON DELETE SET NULL,
  ansvarlig TEXT DEFAULT '',
  status prosjekt_status DEFAULT 'Ny',
  startdato DATE DEFAULT CURRENT_DATE,
  forventet_go_live DATE,
  go_live_dato DATE,
  oppstartskostnad NUMERIC DEFAULT 0,
  oppstart_fakturert BOOLEAN DEFAULT false,
  oppstart_faktura_dato DATE,
  oppstart_betalt BOOLEAN DEFAULT false,
  integrasjon integrasjon DEFAULT 'Ingen',
  notater TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prosjekter ENABLE ROW LEVEL SECURITY;

-- ============ OPPGAVER ============
CREATE TABLE public.oppgaver (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oppgave TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  selskap_id UUID REFERENCES public.selskaper(id) ON DELETE SET NULL,
  salgsmulighet_id UUID REFERENCES public.salgsmuligheter(id) ON DELETE SET NULL,
  ansvarlig TEXT DEFAULT '',
  frist DATE,
  prioritet prioritet DEFAULT 'Medium',
  status oppgave_status DEFAULT 'Åpen',
  paaminnelse BOOLEAN DEFAULT true,
  notater TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oppgaver ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth read selskaper" ON public.selskaper FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert selskaper" ON public.selskaper FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update selskaper" ON public.selskaper FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete selskaper" ON public.selskaper FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth read kontakter" ON public.kontakter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert kontakter" ON public.kontakter FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update kontakter" ON public.kontakter FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete kontakter" ON public.kontakter FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth read leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete leads" ON public.leads FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth read partnere" ON public.partnere FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert partnere" ON public.partnere FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update partnere" ON public.partnere FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete partnere" ON public.partnere FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth read salgsmuligheter" ON public.salgsmuligheter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert salgsmuligheter" ON public.salgsmuligheter FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update salgsmuligheter" ON public.salgsmuligheter FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete salgsmuligheter" ON public.salgsmuligheter FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth read prosjekter" ON public.prosjekter FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert prosjekter" ON public.prosjekter FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update prosjekter" ON public.prosjekter FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete prosjekter" ON public.prosjekter FOR DELETE TO authenticated USING (true);

CREATE POLICY "Users read own tasks" ON public.oppgaver FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own tasks" ON public.oppgaver FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own tasks" ON public.oppgaver FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own tasks" ON public.oppgaver FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_selskaper_updated_at BEFORE UPDATE ON public.selskaper FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kontakter_updated_at BEFORE UPDATE ON public.kontakter FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partnere_updated_at BEFORE UPDATE ON public.partnere FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_salgsmuligheter_updated_at BEFORE UPDATE ON public.salgsmuligheter FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prosjekter_updated_at BEFORE UPDATE ON public.prosjekter FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oppgaver_updated_at BEFORE UPDATE ON public.oppgaver FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ AUTO-CREATE PROFILE + ROLE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
