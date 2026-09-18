-- Durable inbox/queue for Meta Lead Ads webhook deliveries
CREATE TABLE public.meta_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leadgen_id text NOT NULL,
  page_id text NOT NULL,
  form_id text,
  form_name text,
  ad_id text,
  ad_name text,
  adgroup_id text,
  campaign_id text,
  campaign_name text,
  created_time timestamptz,
  raw_change jsonb NOT NULL,
  lead_payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT meta_lead_events_leadgen_id_key UNIQUE (leadgen_id),
  CONSTRAINT meta_lead_events_status_check CHECK (status IN ('pending','processing','done','failed','ignored'))
);

CREATE INDEX meta_lead_events_status_idx ON public.meta_lead_events (status, next_attempt_at);
CREATE INDEX meta_lead_events_received_idx ON public.meta_lead_events (received_at DESC);

GRANT SELECT ON public.meta_lead_events TO authenticated;
GRANT ALL ON public.meta_lead_events TO service_role;

ALTER TABLE public.meta_lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read meta lead events"
ON public.meta_lead_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Singleton state row for the integration
CREATE TABLE public.meta_integration_state (
  id text PRIMARY KEY DEFAULT 'default',
  connection_verified boolean NOT NULL DEFAULT false,
  verified_page_id text,
  last_verify_at timestamptz,
  last_event_at timestamptz,
  last_processed_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_integration_state TO authenticated;
GRANT ALL ON public.meta_integration_state TO service_role;

ALTER TABLE public.meta_integration_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read meta integration state"
ON public.meta_integration_state FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.meta_integration_state (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- Atomic claim with lease; also reclaims expired leases after a crash
CREATE OR REPLACE FUNCTION public.claim_meta_lead_events(p_limit integer DEFAULT 10, p_lease_seconds integer DEFAULT 120)
RETURNS SETOF public.meta_lead_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT e.id
    FROM public.meta_lead_events e
    WHERE (e.status = 'pending' AND e.next_attempt_at <= now())
       OR (e.status = 'processing' AND e.locked_until IS NOT NULL AND e.locked_until < now())
    ORDER BY e.received_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.meta_lead_events t
  SET status = 'processing',
      locked_until = now() + make_interval(secs => p_lease_seconds),
      attempts = t.attempts + 1
  FROM candidates c
  WHERE t.id = c.id
  RETURNING t.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_meta_lead_events(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_lead_events(integer, integer) TO service_role;