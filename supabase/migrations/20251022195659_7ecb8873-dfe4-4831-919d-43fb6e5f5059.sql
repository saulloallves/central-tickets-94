-- ========================================
-- CORREÇÃO DEFINITIVA DO SISTEMA SLA
-- ========================================

-- 1. CORRIGIR get_sla_minutes_for_priority()
CREATE OR REPLACE FUNCTION public.get_sla_minutes_for_priority(p_prioridade ticket_prioridade)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sla_minutes INTEGER;
  settings_data JSONB;
BEGIN
  SELECT priority_matrix INTO settings_data
  FROM ai_classifier_advanced_settings
  WHERE ativo = true
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF settings_data IS NOT NULL THEN
    sla_minutes := (settings_data -> p_prioridade::text -> 'sla_minutes')::INTEGER;
  END IF;
  
  IF sla_minutes IS NULL OR sla_minutes <= 0 THEN
    sla_minutes := CASE p_prioridade
      WHEN 'imediato' THEN 30
      WHEN 'alto' THEN 60
      WHEN 'medio' THEN 600
      WHEN 'baixo' THEN 1400
      WHEN 'crise' THEN 5
      ELSE 1440
    END;
  END IF;
  
  RETURN sla_minutes;
END;
$function$;

-- 2. CORRIGIR calcular_data_limite_sla()
CREATE OR REPLACE FUNCTION public.calcular_data_limite_sla(
  p_data_abertura TIMESTAMPTZ,
  p_prioridade TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sla_minutos INTEGER;
  v_data_limite TIMESTAMPTZ;
BEGIN
  v_sla_minutos := get_sla_minutes_for_priority(p_prioridade::ticket_prioridade);
  v_data_limite := adicionar_minutos_uteis(p_data_abertura, v_sla_minutos);
  RETURN v_data_limite;
END;
$function$;

-- 3. CORRIGIR TICKETS EXISTENTES
DO $$
DECLARE
  v_affected INTEGER;
BEGIN
  UPDATE tickets
  SET 
    data_limite_sla = calcular_data_limite_sla(data_abertura, prioridade::TEXT),
    sla_half_time = calcular_data_limite_sla(data_abertura, prioridade::TEXT) - ((sla_minutos_totais / 2) || ' minutes')::INTERVAL
  WHERE 
    (
      (prioridade = 'imediato' AND sla_minutos_totais = 30 AND EXTRACT(EPOCH FROM (data_limite_sla - data_abertura)) / 60 < 20)
      OR (prioridade = 'medio' AND sla_minutos_totais = 600 AND EXTRACT(EPOCH FROM (data_limite_sla - data_abertura)) / 60 > 1000)
      OR (prioridade = 'baixo' AND sla_minutos_totais = 1400 AND EXTRACT(EPOCH FROM (data_limite_sla - data_abertura)) / 60 > 2000)
    )
    AND data_abertura >= NOW() - INTERVAL '30 days'
    AND status != 'concluido';
  
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RAISE NOTICE '✅ Sistema SLA corrigido - % tickets atualizados', v_affected;
END $$;