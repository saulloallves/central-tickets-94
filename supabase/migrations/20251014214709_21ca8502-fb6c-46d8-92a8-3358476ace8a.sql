-- Criar função para pausar SLA manualmente (para testes e fallback)
CREATE OR REPLACE FUNCTION pause_sla_tickets()
RETURNS TABLE(
  tickets_pausados INTEGER,
  tickets_resumidos INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hora INTEGER;
  v_pausados INTEGER := 0;
  v_resumidos INTEGER := 0;
BEGIN
  -- Pegar hora atual em BRT
  v_hora := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo');
  
  -- Se fora do horário comercial (antes de 8:30 ou depois de 17:30), pausar
  IF v_hora < 8 OR v_hora >= 17 THEN
    -- Pausar tickets abertos e em atendimento
    UPDATE tickets
    SET 
      sla_pausado = true,
      sla_pausado_em = NOW()
    WHERE status IN ('aberto', 'em_atendimento')
      AND sla_pausado = false
      AND sla_pausado_mensagem = false;
    
    GET DIAGNOSTICS v_pausados = ROW_COUNT;
    
    -- Log
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'tickets',
      'bulk',
      'SLA pausado automaticamente - fora do horário comercial',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('tickets_pausados', v_pausados, 'hora', v_hora),
      'web'::log_canal
    );
  ELSE
    -- Dentro do horário, resumir tickets pausados
    UPDATE tickets
    SET 
      sla_pausado = false
    WHERE status IN ('aberto', 'em_atendimento')
      AND sla_pausado = true;
    
    GET DIAGNOSTICS v_resumidos = ROW_COUNT;
    
    -- Log
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'tickets',
      'bulk',
      'SLA resumido automaticamente - dentro do horário comercial',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('tickets_resumidos', v_resumidos, 'hora', v_hora),
      'web'::log_canal
    );
  END IF;
  
  RETURN QUERY SELECT v_pausados, v_resumidos;
END;
$$;

-- Executar agora para pausar tickets pendentes
SELECT * FROM pause_sla_tickets();
