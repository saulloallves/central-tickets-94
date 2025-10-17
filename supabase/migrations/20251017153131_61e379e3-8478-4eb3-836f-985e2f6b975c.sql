-- Primeiro fazer DROP da função antiga
DROP FUNCTION IF EXISTS decrementar_sla_minutos();

-- ============================================
-- CORREÇÃO CRÍTICA DO SLA: decrementar_sla_minutos
-- ============================================
-- Problema: Quando ticket é despausado, sla_ultima_atualizacao mantém timestamp antigo
-- Solução: Sempre atualizar sla_ultima_atualizacao para NOW() ao decrementar

CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS TABLE(tickets_atualizados integer, tickets_vencidos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_minutos_decorridos INTEGER;
  v_tickets_atualizados INTEGER := 0;
  v_tickets_vencidos INTEGER := 0;
BEGIN
  FOR v_ticket IN
    SELECT 
      id,
      sla_minutos_restantes,
      sla_ultima_atualizacao,
      codigo_ticket,
      status
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento')
      AND sla_pausado = FALSE  -- ← Só processar se NÃO está pausado
      AND sla_pausado_mensagem = FALSE
      AND sla_pausado_horario = FALSE
      AND sla_minutos_restantes IS NOT NULL
      AND sla_minutos_restantes > 0
      AND sla_ultima_atualizacao IS NOT NULL  -- ← Validação importante
  LOOP
    -- ✅ CORREÇÃO: Calcular tempo decorrido desde última atualização
    -- Se ticket foi despausado, sla_ultima_atualizacao foi resetado para NOW()
    -- Portanto, tempo pausado NÃO será contado
    v_minutos_decorridos := EXTRACT(EPOCH FROM (NOW() - v_ticket.sla_ultima_atualizacao)) / 60;
    
    IF v_minutos_decorridos >= 1 THEN
      UPDATE tickets
      SET 
        sla_minutos_restantes = GREATEST(0, sla_minutos_restantes - v_minutos_decorridos::INTEGER),
        sla_ultima_atualizacao = NOW(),  -- ← SEMPRE atualizar para NOW()
        status_sla = CASE
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER) <= 0 THEN 'vencido'
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER)::DECIMAL / NULLIF(sla_minutos_totais, 0) < 0.5 THEN 'alerta'
          ELSE 'dentro_prazo'
        END
      WHERE id = v_ticket.id;
      
      v_tickets_atualizados := v_tickets_atualizados + 1;
      
      IF (v_ticket.sla_minutos_restantes - v_minutos_decorridos) <= 0 THEN
        v_tickets_vencidos := v_tickets_vencidos + 1;
        RAISE NOTICE '⏱️ SLA VENCIDO: Ticket % - minutos restantes: %', 
          v_ticket.codigo_ticket, 
          (v_ticket.sla_minutos_restantes - v_minutos_decorridos);
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_tickets_atualizados, v_tickets_vencidos;
END;
$$;