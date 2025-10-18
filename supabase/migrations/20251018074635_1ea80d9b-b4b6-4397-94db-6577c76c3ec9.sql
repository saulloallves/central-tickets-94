-- Criar função para verificar e pausar SLA automaticamente se criado fora do horário
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
    NEW.sla_pausado_aguardando_resposta := false;
    
    -- Criar registro de pausa na tabela pausas_sla
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

-- Criar trigger para pausar automaticamente quando ticket é criado fora do horário
DROP TRIGGER IF EXISTS trigger_auto_pausar_sla_fora_horario ON tickets;
CREATE TRIGGER trigger_auto_pausar_sla_fora_horario
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_pausar_sla_fora_horario();