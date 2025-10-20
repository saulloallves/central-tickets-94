-- ========================================
-- FIX IMEDIATO + SOLUÇÃO DEFINITIVA: Cálculo de SLA em Tempo Real
-- ========================================

-- PARTE 1: FIX IMEDIATO - Criar cron job para rodar a cada 1 minuto
-- ========================================

-- Criar job rodando a cada 1 minuto
SELECT cron.schedule(
  'sla-processor-schedule',
  '* * * * *', -- ✅ A cada 1 minuto
  $$
  SELECT
    net.http_post(
        url:='https://hryurntaljdisohawpqf.supabase.co/functions/v1/sla-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

-- PARTE 2: SOLUÇÃO DEFINITIVA - Função de Cálculo de SLA em Tempo Real
-- ========================================

-- Criar função para calcular SLA em tempo real baseado em data_abertura
CREATE OR REPLACE FUNCTION calcular_sla_tempo_real(
  p_ticket_id UUID
)
RETURNS TABLE (
  sla_minutos_decorridos INTEGER,
  sla_minutos_restantes INTEGER,
  status_sla ticket_sla_status,
  is_overdue BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_minutos_decorridos INTEGER;
  v_minutos_restantes INTEGER;
  v_status_sla ticket_sla_status;
  v_is_overdue BOOLEAN;
BEGIN
  -- Buscar dados do ticket
  SELECT 
    t.created_at,
    t.sla_minutos_totais,
    t.tempo_pausado_total,
    t.sla_pausado,
    t.sla_pausado_horario,
    t.sla_pausado_feedback,
    t.status
  INTO v_ticket
  FROM tickets t
  WHERE t.id = p_ticket_id;

  -- Se ticket não existe ou está concluído, retornar NULL
  IF NOT FOUND OR v_ticket.status = 'concluido' THEN
    RETURN;
  END IF;

  -- Calcular minutos decorridos desde abertura
  v_minutos_decorridos := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;

  -- Subtrair tempo pausado total
  v_minutos_decorridos := v_minutos_decorridos - COALESCE(v_ticket.tempo_pausado_total, 0);

  -- Calcular minutos restantes
  v_minutos_restantes := COALESCE(v_ticket.sla_minutos_totais, 0) - v_minutos_decorridos;

  -- Determinar status do SLA
  v_is_overdue := v_minutos_restantes <= 0;

  IF v_is_overdue THEN
    v_status_sla := 'vencido'::ticket_sla_status;
  ELSIF v_minutos_restantes <= (COALESCE(v_ticket.sla_minutos_totais, 0) / 2) THEN
    v_status_sla := 'meio_prazo'::ticket_sla_status;
  ELSE
    v_status_sla := 'normal'::ticket_sla_status;
  END IF;

  -- Retornar valores calculados
  RETURN QUERY SELECT 
    v_minutos_decorridos,
    v_minutos_restantes,
    v_status_sla,
    v_is_overdue;
END;
$$;

COMMENT ON FUNCTION calcular_sla_tempo_real(UUID) IS 'Calcula SLA em tempo real baseado na data de abertura do ticket, considerando tempo pausado';

-- Criar view que expõe tickets com SLA calculado em tempo real
CREATE OR REPLACE VIEW tickets_with_realtime_sla AS
SELECT 
  t.*,
  sla.sla_minutos_decorridos,
  sla.sla_minutos_restantes AS sla_minutos_restantes_calculado,
  sla.status_sla AS status_sla_calculado,
  sla.is_overdue
FROM tickets t
LEFT JOIN LATERAL calcular_sla_tempo_real(t.id) sla ON true;

COMMENT ON VIEW tickets_with_realtime_sla IS 'View que expõe tickets com valores de SLA calculados em tempo real';

-- Log da migration
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_sla_realtime_calculation',
  'Implementado cálculo de SLA em tempo real + cron job a cada 1 minuto',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'changes', ARRAY[
      'Cron job: criado para rodar a cada 1 minuto',
      'Criada função: calcular_sla_tempo_real()',
      'Criada view: tickets_with_realtime_sla'
    ]
  ),
  'sistema'::log_canal
);