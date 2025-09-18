-- Configurar processamento automático de SLAs com cron job

-- Primeiro, vamos garantir que as extensões necessárias estão habilitadas
SELECT cron.schedule(
  'sla-auto-processor',
  '* * * * *', -- Executa a cada minuto
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/sla-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
    body := '{"automated": true}'::jsonb
  ) as request_id;
  $$
);

-- Opcional: Verificar se o job foi criado corretamente
-- SELECT * FROM cron.job WHERE jobname = 'sla-auto-processor';