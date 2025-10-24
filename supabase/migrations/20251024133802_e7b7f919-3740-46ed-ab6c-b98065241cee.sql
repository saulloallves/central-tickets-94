-- ========================================
-- CORREÇÃO DO SISTEMA DE ESCALONAMENTO
-- Corrige process_overdue_slas() e reverte tickets afetados
-- ========================================

-- 1. DROPAR E RECRIAR FUNÇÃO process_overdue_slas()
DROP FUNCTION IF EXISTS process_overdue_slas();

CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ticket RECORD;
  v_escalation_matrix jsonb;
  v_current_level INTEGER;
  v_destination TEXT;
  notification_destination TEXT;
  v_result jsonb := jsonb_build_object('processed', 0, 'escalated', 0, 'notified', 0);
BEGIN
  -- Buscar tickets vencidos que não foram escalonados e NÃO estão pausados
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.prioridade,
      t.escalonamento_nivel,
      t.grupo_whatsapp_id,
      t.unidade_id,
      u.codigo_grupo
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status_sla = 'vencido'::ticket_sla_status
      AND t.status NOT IN ('concluido', 'escalonado')
      AND NOT (
        COALESCE(t.sla_pausado, false) 
        OR COALESCE(t.sla_pausado_mensagem, false) 
        OR COALESCE(t.sla_pausado_horario, false)
      )
    ORDER BY t.data_limite_sla ASC
    LIMIT 50
  LOOP
    v_result := jsonb_set(v_result, '{processed}', to_jsonb((v_result->>'processed')::int + 1));
    
    -- Obter matriz de escalonamento
    SELECT config_value INTO v_escalation_matrix
    FROM system_config
    WHERE config_key = 'escalation_matrix'
    LIMIT 1;
    
    v_current_level := COALESCE(v_ticket.escalonamento_nivel, 0);
    
    -- Determinar destino da notificação
    IF v_escalation_matrix IS NOT NULL THEN
      v_destination := v_escalation_matrix->v_ticket.prioridade->(v_current_level + 1)::text->>'destination';
      
      IF v_destination = 'unidade' THEN
        notification_destination := v_ticket.grupo_whatsapp_id;
      ELSIF v_destination = 'coordenador' THEN
        SELECT grupo_whatsapp_id INTO notification_destination
        FROM unidades
        WHERE codigo_grupo = v_ticket.codigo_grupo
        LIMIT 1;
      ELSIF v_destination = 'supervisor' THEN
        SELECT config_value->>'grupo_supervisor' INTO notification_destination
        FROM system_config
        WHERE config_key = 'escalation_matrix'
        LIMIT 1;
      ELSE
        notification_destination := v_ticket.grupo_whatsapp_id;
      END IF;
    ELSE
      notification_destination := v_ticket.grupo_whatsapp_id;
    END IF;
    
    -- Atualizar status do ticket (SEM escalonado_para)
    UPDATE tickets
    SET 
      status = 'escalonado',
      escalonamento_nivel = COALESCE(escalonamento_nivel, 0) + 1,
      sla_escalado_em = NOW(),
      updated_at = NOW()
    WHERE id = v_ticket.id;
    
    v_result := jsonb_set(v_result, '{escalated}', to_jsonb((v_result->>'escalated')::int + 1));
    
    -- Registrar log de escalonamento
    INSERT INTO escalation_logs (
      ticket_id,
      from_level,
      to_level,
      event_type,
      message,
      canal,
      response
    )
    VALUES (
      v_ticket.id,
      v_current_level,
      v_current_level + 1,
      'sla_breach',
      'SLA vencido - Escalonamento automático',
      'whatsapp',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'prioridade', v_ticket.prioridade,
        'destino_whatsapp', notification_destination,
        'sla_vencido_em', NOW()
      )
    );
    
    -- Criar notificação na fila
    INSERT INTO notifications_queue (
      ticket_id,
      type,
      destination,
      message_data,
      status
    )
    VALUES (
      v_ticket.id,
      'sla_breach',
      notification_destination,
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'prioridade', v_ticket.prioridade,
        'nivel_escalonamento', v_current_level + 1
      ),
      'pending'
    );
    
    v_result := jsonb_set(v_result, '{notified}', to_jsonb((v_result->>'notified')::int + 1));
  END LOOP;
  
  RETURN v_result;
END;
$$;

-- 2. REVERTER TICKETS PAUSADOS QUE FORAM ESCALONADOS INDEVIDAMENTE
UPDATE tickets
SET 
  status = 'em_atendimento',
  escalonamento_nivel = 0,
  sla_escalado_em = NULL,
  updated_at = NOW()
WHERE id = '7a18ddc8-8156-4e18-a5b8-a255159aacee'
  AND sla_pausado_mensagem = true;

-- 3. LIMPAR NOTIFICAÇÕES DUPLICADAS (manter apenas a mais recente de cada tipo)
DELETE FROM notifications_queue
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id, 
      ROW_NUMBER() OVER (PARTITION BY ticket_id, type ORDER BY created_at DESC) as rn
    FROM notifications_queue
    WHERE ticket_id = '7a18ddc8-8156-4e18-a5b8-a255159aacee'
      AND status = 'pending'
  ) t 
  WHERE rn > 1
);