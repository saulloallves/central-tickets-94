-- Drop e recriar função e view com precisão de segundos no cálculo de SLA

-- Dropar view e função existentes (CASCADE para dependências)
DROP VIEW IF EXISTS tickets_with_realtime_sla CASCADE;
DROP FUNCTION IF EXISTS calcular_sla_tempo_real(UUID) CASCADE;

-- Recriar função com campo adicional de segundos
CREATE OR REPLACE FUNCTION calcular_sla_tempo_real(
  p_ticket_id UUID
)
RETURNS TABLE (
  sla_minutos_decorridos INTEGER,
  sla_minutos_restantes INTEGER,
  sla_segundos_restantes INTEGER,
  status_sla ticket_sla_status,
  is_overdue BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_segundos_decorridos INTEGER;
  v_minutos_decorridos INTEGER;
  v_minutos_restantes INTEGER;
  v_segundos_restantes INTEGER;
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

  -- Calcular segundos decorridos desde abertura (PRECISÃO EM SEGUNDOS)
  v_segundos_decorridos := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at))::INTEGER;

  -- Subtrair tempo pausado total (converter minutos para segundos)
  v_segundos_decorridos := v_segundos_decorridos - (COALESCE(v_ticket.tempo_pausado_total, 0) * 60);

  -- Calcular segundos restantes
  v_segundos_restantes := (COALESCE(v_ticket.sla_minutos_totais, 0) * 60) - v_segundos_decorridos;

  -- Calcular minutos para compatibilidade
  v_minutos_decorridos := v_segundos_decorridos / 60;
  v_minutos_restantes := v_segundos_restantes / 60;

  -- Determinar status do SLA
  v_is_overdue := v_segundos_restantes <= 0;

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
    v_segundos_restantes,
    v_status_sla,
    v_is_overdue;
END;
$$;

COMMENT ON FUNCTION calcular_sla_tempo_real(UUID) IS 'Calcula SLA em tempo real com precisão em segundos, baseado na data de abertura do ticket';

-- Recriar view para incluir segundos restantes
CREATE OR REPLACE VIEW tickets_with_realtime_sla AS
SELECT 
  t.*,
  sla.sla_minutos_decorridos,
  sla.sla_minutos_restantes AS sla_minutos_restantes_calculado,
  sla.sla_segundos_restantes,
  sla.status_sla AS status_sla_calculado,
  sla.is_overdue
FROM tickets t
LEFT JOIN LATERAL calcular_sla_tempo_real(t.id) sla ON true;

COMMENT ON VIEW tickets_with_realtime_sla IS 'View que expõe tickets com valores de SLA calculados em tempo real (precisão em segundos)';

-- Recriar permissões RLS para a view
GRANT SELECT ON tickets_with_realtime_sla TO authenticated;
ALTER VIEW tickets_with_realtime_sla SET (security_barrier = true, security_invoker = true);

-- Log da migration
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'add_sla_seconds_precision',
  'Adicionada precisão de segundos no cálculo de SLA em tempo real',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'changes', ARRAY[
      'Função calcular_sla_tempo_real: adiciona sla_segundos_restantes',
      'View tickets_with_realtime_sla: expõe campo sla_segundos_restantes',
      'Cálculo interno: usa segundos ao invés de minutos para máxima precisão'
    ]
  ),
  'sistema'::log_canal
);