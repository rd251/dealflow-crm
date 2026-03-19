
ALTER TABLE public.google_calendar_connections
  ADD COLUMN gmail_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN gmail_history_id text,
  ADD COLUMN gmail_last_synced_at timestamp with time zone;
