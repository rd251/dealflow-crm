select cron.schedule(
  'nudge-awaiting-reply',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tchmujgzcklwgptocbno.supabase.co/functions/v1/nudge-awaiting-reply',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);