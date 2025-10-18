-- Corrigir função para reiniciar e pausar SLAs (remover ON CONFLICT incorreto)
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
      sla_minutos_restantes,
      sla_minutos_totais
    FROM tickets
    WHERE status != 'concluido'
      AND (sla_pausado_horario = false OR sla_pausado_horario IS NULL)
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
      data_limite_sla = NOW() + (v_sla_minutos || ' minutes')::INTERVAL,
      tempo_pausado_total = COALESCE(tempo_pausado_total, INTERVAL '0')
    WHERE id = v_ticket.id;
    
    -- Criar registro de pausa (sem ON CONFLICT, apenas insere)
    INSERT INTO pausas_sla (
      ticket_id,
      motivo,
      pausa_inicio
    ) VALUES (
      v_ticket.id,
      'Reinício manual - Fora do horário comercial',
      NOW()
    );
    
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

-- Também corrigir a função de auto pausar
CREATE OR REPLACE FUNCTION auto_pausar_sla_fora_horario()
RETURNS TRIGGER AS $$
DECLARE
  v_is_business_hours BOOLEAN;
  v_hora_atual TIME;
  v_dia_semana INTEGER;
BEGIN
  -- Pegar horário de São Paulo
  v_hora_atual := (NOW() AT TIME ZONE 'America/Sao_Paulo')::TIME;
  v_dia_semana := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  
  -- Verificar se está dentro do horário comercial (08:30 - 17:30, seg-sáb)
  -- Domingo = 0, Segunda = 1, ..., Sábado = 6
  v_is_business_hours := (
    v_dia_semana BETWEEN 1 AND 6 AND
    v_hora_atual BETWEEN '08:30:00'::TIME AND '17:30:00'::TIME
  );
  
  -- Se estiver FORA do horário comercial, pausar automaticamente
  IF NOT v_is_business_hours THEN
    NEW.sla_pausado_horario := true;
    
    -- Criar registro de pausa na tabela pausas_sla (sem ON CONFLICT)
    INSERT INTO pausas_sla (
      ticket_id,
      motivo,
      pausa_inicio
    ) VALUES (
      NEW.id,
      'Fora do horário comercial',
      NOW()
    );
    
    -- Log da ação
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'tickets',
      NEW.id::TEXT,
      'Ticket criado fora do horário comercial - SLA pausado automaticamente',
      NEW.criado_por,
      NULL, NULL, NULL, NULL,
      jsonb_build_object(
        'hora_criacao', v_hora_atual,
        'dia_semana', v_dia_semana,
        'sla_pausado_horario', true
      ),
      'web'::log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;