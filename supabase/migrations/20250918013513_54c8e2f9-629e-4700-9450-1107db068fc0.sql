-- Remove existing cron job if exists
SELECT cron.unschedule('sla-processor-schedule');

-- Schedule sla-processor to run every 2 minutes
SELECT cron.schedule(
  'sla-processor-schedule',
  '*/2 * * * *', -- every 2 minutes
  $$
  SELECT
    net.http_post(
        url:='https://hryurntaljdisohawpqf.supabase.co/functions/v1/sla-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);