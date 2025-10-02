-- ============================================
-- FASE 1: Adicionar colunas para controle de pausa de SLA
-- ============================================

-- Adicionar colunas na tabela tickets
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS sla_pausado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sla_pausado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tempo_pausado_total INTERVAL DEFAULT '0 seconds'::INTERVAL;

-- Criar índice para performance nas consultas de tickets pausados
CREATE INDEX IF NOT EXISTS idx_tickets_sla_pausado 
ON public.tickets(sla_pausado, status) 
WHERE sla_pausado = TRUE AND status IN ('aberto', 'em_atendimento');

-- Comentários para documentação
COMMENT ON COLUMN public.tickets.sla_pausado IS 'Indica se o SLA está pausado (fora do horário comercial)';
COMMENT ON COLUMN public.tickets.sla_pausado_em IS 'Data/hora em que o SLA foi pausado';
COMMENT ON COLUMN public.tickets.tempo_pausado_total IS 'Tempo total que o SLA ficou pausado (acumulado)';

-- ============================================
-- FASE 4: Configurar Cron Jobs para pausa/despausa automática
-- ============================================

-- Job para PAUSAR SLA às 18h30 (Segunda a Sábado)
-- Roda entre 18h25 e 18h35 para garantir execução
SELECT cron.schedule(
  'pause-sla-at-end-of-business',
  '25-35 18 * * 1-6',
  $$
  SELECT net.http_post(
    url:='https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk", "Content-Type": "application/json"}'::jsonb,
    body:='{"action": "pause"}'::jsonb
  ) as request_id;
  $$
);

-- Job para DESPAUSAR SLA às 8h30 (Segunda a Sábado)
-- Roda entre 8h25 e 8h35 para garantir execução
SELECT cron.schedule(
  'resume-sla-at-start-of-business',
  '25-35 8 * * 1-6',
  $$
  SELECT net.http_post(
    url:='https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk", "Content-Type": "application/json"}'::jsonb,
    body:='{"action": "resume"}'::jsonb
  ) as request_id;
  $$
);