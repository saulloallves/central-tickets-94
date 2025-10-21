-- Remover função antiga e view que depende dela
DROP FUNCTION IF EXISTS calcular_sla_tempo_real(UUID) CASCADE;

-- Recriar função permitindo valores negativos para contagem de tempo vencido
CREATE OR REPLACE FUNCTION calcular_sla_tempo_real(p_ticket_id UUID)
RETURNS TABLE (
  sla_minutos_decorridos INTEGER,
  sla_minutos_restantes INTEGER,
  sla_segundos_restantes INTEGER,
  status_sla_calculado TEXT,
  is_overdue BOOLEAN
) AS $$
DECLARE
  v_ticket RECORD;
  tempo_decorrido_minutos INTEGER;
  tempo_pausado_minutos INTEGER;
  sla_restante_calculado INTEGER;
BEGIN
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_ticket.status = 'concluido' THEN
    RETURN QUERY SELECT 
      0 as sla_minutos_decorridos,
      0 as sla_minutos_restantes,
      0 as sla_segundos_restantes,
      'concluido'::TEXT as status_sla_calculado,
      false as is_overdue;
    RETURN;
  END IF;

  IF v_ticket.sla_minutos_totais IS NULL THEN
    RETURN QUERY SELECT 
      NULL::INTEGER,
      NULL::INTEGER,
      NULL::INTEGER,
      NULL::TEXT,
      false;
    RETURN;
  END IF;

  tempo_decorrido_minutos := EXTRACT(EPOCH FROM (now() - v_ticket.data_abertura)) / 60;
  tempo_pausado_minutos := EXTRACT(EPOCH FROM COALESCE(v_ticket.tempo_pausado_total, INTERVAL '0')) / 60;
  
  -- ✅ Permitir valores negativos para indicar quanto tempo está vencido
  sla_restante_calculado := v_ticket.sla_minutos_totais - tempo_decorrido_minutos + tempo_pausado_minutos;

  RETURN QUERY SELECT 
    tempo_decorrido_minutos as sla_minutos_decorridos,
    sla_restante_calculado as sla_minutos_restantes,
    (sla_restante_calculado * 60) as sla_segundos_restantes,
    CASE 
      WHEN sla_restante_calculado <= 0 THEN 'vencido'
      WHEN sla_restante_calculado <= (v_ticket.sla_minutos_totais * 0.25) THEN 'critico'
      WHEN sla_restante_calculado <= (v_ticket.sla_minutos_totais * 0.5) THEN 'atencao'
      ELSE 'normal'
    END::TEXT as status_sla_calculado,
    (sla_restante_calculado <= 0) as is_overdue;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calcular_sla_tempo_real(UUID) IS 
'Calcula SLA em tempo real. Permite valores negativos para indicar quanto tempo está vencido.';

-- Recriar view tickets_with_realtime_sla sem duplicar a coluna status_sla
CREATE OR REPLACE VIEW tickets_with_realtime_sla AS
SELECT 
  t.*,
  sla.sla_minutos_decorridos,
  sla.sla_minutos_restantes AS sla_minutos_restantes_calculado,
  sla.sla_segundos_restantes,
  sla.status_sla_calculado,
  sla.is_overdue
FROM tickets t
LEFT JOIN LATERAL calcular_sla_tempo_real(t.id) sla ON true;

COMMENT ON VIEW tickets_with_realtime_sla IS 
'View com dados de tickets e cálculo de SLA em tempo real. Valores negativos indicam tempo vencido.';

-- Registrar mudança no log do sistema
SELECT log_system_action(
  'sistema'::log_tipo,
  'database_functions',
  'sla_calculation_fix',
  'Permitido SLA negativo para contagem de tempo vencido',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'removed_line', 'GREATEST(sla_restante_calculado, 0)',
    'reason', 'Permitir contagem negativa após vencimento do SLA',
    'timestamp', NOW()
  ),
  'web'::log_canal
);