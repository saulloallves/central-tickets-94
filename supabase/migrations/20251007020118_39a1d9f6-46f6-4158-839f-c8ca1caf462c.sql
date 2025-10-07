-- ========================================
-- CRON JOBS PARA PAUSA/RETOMADA DE SLA
-- ========================================

-- Pausa SLA às 18h30 (hora de São Paulo)
-- Converte: 18h30 SP = 21h30 UTC (UTC-3)
SELECT cron.schedule(
  'pause-sla-at-business-close',
  '30 21 * * 1-6',  -- 21h30 UTC = 18h30 SP, Segunda a Sábado
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('action', 'pause')
  );
  $$
);

-- Retoma SLA às 8h30 (hora de São Paulo)
-- Converte: 8h30 SP = 11h30 UTC (UTC-3)
SELECT cron.schedule(
  'resume-sla-at-business-start',
  '30 11 * * 1-6',  -- 11h30 UTC = 8h30 SP, Segunda a Sábado
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('action', 'resume')
  );
  $$
);