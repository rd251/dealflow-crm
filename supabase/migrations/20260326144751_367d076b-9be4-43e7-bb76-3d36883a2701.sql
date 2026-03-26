
CREATE TABLE public.email_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  primary_email TEXT NOT NULL,
  all_emails TEXT[] NOT NULL DEFAULT '{}',
  display_name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  last_activity_type TEXT DEFAULT '',
  total_emails_sent INTEGER NOT NULL DEFAULT 0,
  total_emails_received INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  kontakt_id UUID,
  lead_id UUID,
  salgsmulighet_id UUID,
  selskap_id UUID,
  partner_id UUID,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(primary_email, user_id)
);

ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email_contacts" ON public.email_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own email_contacts" ON public.email_contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own email_contacts" ON public.email_contacts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own email_contacts" ON public.email_contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Service role needs full access for edge function
CREATE POLICY "Service role full access email_contacts" ON public.email_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_email_contacts_primary_email ON public.email_contacts(primary_email);
CREATE INDEX idx_email_contacts_user_id ON public.email_contacts(user_id);
CREATE INDEX idx_email_contacts_last_contacted ON public.email_contacts(last_contacted_at DESC NULLS LAST);
