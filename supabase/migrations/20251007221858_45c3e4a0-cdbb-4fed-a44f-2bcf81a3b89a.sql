-- Remover jobs antigos/duplicados
SELECT cron.unschedule('pause-sla-at-end-of-business');
SELECT cron.unschedule('resume-sla-at-start-of-business');
SELECT cron.unschedule('pause-sla-at-business-close');
SELECT cron.unschedule('resume-sla-at-business-start');

-- Criar job para PAUSAR SLA às 18h30 BRT (21h30 UTC)
SELECT cron.schedule(
  'pause-sla-18h30-brt',
  '30 21 * * 1-6', -- 21h30 UTC = 18h30 BRT (seg-sáb)
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk'
    ),
    body := jsonb_build_object(
      'action', 'pause',
      'timestamp', now()::text
    )
  ) as request_id;
  $$
);

-- Criar job para DESPAUSAR SLA às 8h30 BRT (11h30 UTC)
SELECT cron.schedule(
  'resume-sla-08h30-brt',
  '30 11 * * 1-6', -- 11h30 UTC = 8h30 BRT (seg-sáb)
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk'
    ),
    body := jsonb_build_object(
      'action', 'resume',
      'timestamp', now()::text
    )
  ) as request_id;
  $$
);

-- Log da criação dos cron jobs
DO $$
BEGIN
  RAISE NOTICE '✅ Cron jobs de pausa/despause de SLA recriados com sucesso!';
  RAISE NOTICE '⏰ PAUSE às 18h30 BRT (21h30 UTC) Segunda-Sábado';
  RAISE NOTICE '⏰ RESUME às 08h30 BRT (11h30 UTC) Segunda-Sábado';
END $$;