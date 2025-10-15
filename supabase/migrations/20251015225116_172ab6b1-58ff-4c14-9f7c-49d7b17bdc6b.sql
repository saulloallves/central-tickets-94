-- Remove job genérico antigo se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pause-resume-sla') THEN
    PERFORM cron.unschedule('pause-resume-sla');
  END IF;
END $$;

-- Job para PAUSAR SLA às 18h30 BRT (21h30 UTC) Segunda a Sábado
SELECT cron.schedule(
  'pause-sla-18h30-brt',
  '30 21 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
    body := '{"action": "pause"}'::jsonb
  ) as request_id;
  $$
);

-- Job para DESPAUSAR SLA às 8h30 BRT (11h30 UTC) Segunda a Sábado
SELECT cron.schedule(
  'resume-sla-08h30-brt',
  '30 11 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
    body := '{"action": "resume"}'::jsonb
  ) as request_id;
  $$
);