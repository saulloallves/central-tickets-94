-- Função para reiniciar e pausar SLAs de tickets em aberto não pausados
CREATE OR REPLACE FUNCTION reiniciar_e_pausar_slas_abertos()
RETURNS TABLE(
  tickets_processados INTEGER,
  tickets_pausados INTEGER,
  detalhes JSONB
) AS $$
DECLARE
  v_ticket RECORD;
  v_tickets_processados INTEGER := 0;
  v_tickets_pausados INTEGER := 0;
  v_detalhes JSONB := '[]'::JSONB;
  v_sla_minutos INTEGER;
BEGIN
  -- Processar todos os tickets em aberto que não estão pausados
  FOR v_ticket IN
    SELECT 
      id,
      codigo_ticket,
      prioridade,
      status,
      sla_pausado_horario,
      sla_pausado_aguardando_resposta,
      sla_minutos_restantes,
      sla_minutos_totais
    FROM tickets
    WHERE status != 'concluido'
      AND (sla_pausado_horario = false OR sla_pausado_horario IS NULL)
      AND (sla_pausado_aguardando_resposta = false OR sla_pausado_aguardando_resposta IS NULL)
  LOOP
    -- Calcular novo SLA baseado na prioridade
    v_sla_minutos := get_sla_minutes_for_priority(v_ticket.prioridade);
    
    -- Atualizar o ticket: reiniciar SLA e pausar por horário
    UPDATE tickets
    SET 
      sla_minutos_totais = v_sla_minutos,
      sla_minutos_restantes = v_sla_minutos,
      sla_ultima_atualizacao = NOW(),
      sla_pausado_horario = true,
      sla_pausado_aguardando_resposta = false,
      data_limite_sla = NOW() + (v_sla_minutos || ' minutes')::INTERVAL,
      tempo_pausado_total = COALESCE(tempo_pausado_total, INTERVAL '0')
    WHERE id = v_ticket.id;
    
    -- Criar registro de pausa
    INSERT INTO pausas_sla (
      ticket_id,
      motivo,
      pausa_inicio
    ) VALUES (
      v_ticket.id,
      'Reinício manual - Fora do horário comercial',
      NOW()
    )
    ON CONFLICT (ticket_id, motivo, pausa_inicio) DO NOTHING;
    
    -- Log da ação
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'tickets',
      v_ticket.id::TEXT,
      'SLA reiniciado e pausado manualmente',
      auth.uid(),
      NULL, NULL, NULL,
      jsonb_build_object(
        'sla_minutos_antigo', v_ticket.sla_minutos_restantes,
        'sla_minutos_novo', v_sla_minutos
      ),
      jsonb_build_object(
        'sla_minutos_totais', v_sla_minutos,
        'sla_minutos_restantes', v_sla_minutos,
        'sla_pausado_horario', true
      ),
      'web'::log_canal
    );
    
    v_tickets_processados := v_tickets_processados + 1;
    v_tickets_pausados := v_tickets_pausados + 1;
    
    -- Adicionar aos detalhes
    v_detalhes := v_detalhes || jsonb_build_object(
      'ticket_id', v_ticket.id,
      'codigo_ticket', v_ticket.codigo_ticket,
      'sla_anterior', v_ticket.sla_minutos_restantes,
      'sla_novo', v_sla_minutos
    );
  END LOOP;
  
  RETURN QUERY SELECT v_tickets_processados, v_tickets_pausados, v_detalhes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;