-- Remover cron jobs duplicados
SELECT cron.unschedule(14);
SELECT cron.unschedule(15);

-- Atualizar job 11 para pausar às 17:30 BRT (20:30 UTC)
SELECT cron.alter_job(
  11,
  schedule := '30 20 * * 1-6'  -- 17:30 BRT
);

-- Garantir que job 12 está correto (08:30 BRT = 11:30 UTC)
SELECT cron.alter_job(
  12,
  schedule := '30 11 * * 1-6'  -- 08:30 BRT
);
