-- ========================================
-- CORREÇÃO DO SISTEMA DE ESCALONAMENTO SLA
-- ========================================

-- PARTE 1: Corrigir função process_overdue_slas()
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_record RECORD;
  notification_count INTEGER := 0;
  data_limite_efetiva TIMESTAMPTZ;
BEGIN
  FOR ticket_record IN
    SELECT 
      t.id, t.codigo_ticket, t.data_limite_sla, t.tempo_pausado_total,
      t.status_sla, t.status, t.prioridade, t.unidade_id,
      t.equipe_responsavel_id, t.titulo, t.escalonamento_nivel, t.sla_half_time
    FROM tickets t
    WHERE t.status IN ('aberto', 'em_atendimento', 'escalonado')
      AND t.data_limite_sla IS NOT NULL
      AND t.data_limite_sla <= NOW()
      AND t.status_sla != 'vencido'  -- ✅ SÓ PROCESSAR UMA VEZ
  LOOP
    SELECT t.data_limite_sla + COALESCE(t.tempo_pausado_total, INTERVAL '0')
    INTO data_limite_efetiva
    FROM tickets t
    WHERE t.id = ticket_record.id;

    -- ✅ Atualizar APENAS SE NÃO ESTÁ VENCIDO
    UPDATE tickets 
    SET status_sla = 'vencido',
        escalonamento_nivel = COALESCE(escalonamento_nivel, 0) + 1
    WHERE id = ticket_record.id
      AND status_sla != 'vencido';

    -- ✅ Log de escalonamento
    PERFORM log_sla_action(
      ticket_record.id,
      'SLA vencido - Ticket escalonado (nível ' || 
        (COALESCE(ticket_record.escalonamento_nivel, 0) + 1)::TEXT || ')',
      jsonb_build_object(
        'data_limite_efetiva', data_limite_efetiva,
        'nivel_anterior', ticket_record.escalonamento_nivel,
        'novo_nivel', COALESCE(ticket_record.escalonamento_nivel, 0) + 1
      )
    );

    -- Criar notificação (se não existir)
    INSERT INTO notifications_queue (ticket_id, type, payload, status)
    SELECT 
      ticket_record.id, 'sla_breach',
      jsonb_build_object(
        'ticket_id', ticket_record.id,
        'codigo_ticket', ticket_record.codigo_ticket,
        'titulo', ticket_record.titulo,
        'unidade_id', ticket_record.unidade_id,
        'equipe_id', ticket_record.equipe_responsavel_id,
        'prioridade', ticket_record.prioridade,
        'data_limite_original', ticket_record.data_limite_sla,
        'data_limite_efetiva', data_limite_efetiva,
        'tempo_pausado', ticket_record.tempo_pausado_total
      ),
      'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications_queue
      WHERE ticket_id = ticket_record.id AND type = 'sla_breach'
    );

    notification_count := notification_count + 1;
  END LOOP;

  RETURN notification_count;
END;
$$;

-- PARTE 2: Limpar notificações travadas
UPDATE notifications_queue
SET status = 'failed', processed_at = NOW()
WHERE type IN ('sla_breach', 'sla_half')
  AND status = 'pending'
  AND attempts > 3;

-- PARTE 3: Resetar níveis absurdos
UPDATE tickets
SET escalonamento_nivel = 1
WHERE escalonamento_nivel > 10 AND status_sla = 'vencido';