-- Remover cron jobs antigos que usam edge functions
SELECT cron.unschedule(11);
SELECT cron.unschedule(12);

-- Criar cron job SQL nativo para pausar/resumir SLA a cada 10 minutos
SELECT cron.schedule(
  'pause-resume-sla',
  '*/10 * * * *',  -- A cada 10 minutos
  $$SELECT * FROM pause_sla_tickets()$$
);
