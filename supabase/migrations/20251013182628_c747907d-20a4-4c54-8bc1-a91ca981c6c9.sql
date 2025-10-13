-- Atualizar process_overdue_slas para respeitar pausas
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
      t.equipe_responsavel_id, t.titulo, t.escalonamento_nivel,
      t.sla_pausado, t.sla_pausado_mensagem
    FROM tickets t
    WHERE t.status IN ('aberto', 'em_atendimento', 'escalonado')
      AND t.data_limite_sla IS NOT NULL
      AND t.status_sla != 'vencido'
      AND t.sla_pausado = FALSE
      AND t.sla_pausado_mensagem = FALSE
  LOOP
    -- Calcular data limite efetiva (somando tempo pausado)
    data_limite_efetiva := ticket_record.data_limite_sla + COALESCE(ticket_record.tempo_pausado_total, INTERVAL '0');

    -- Só vence se o prazo efetivo já passou
    IF data_limite_efetiva <= NOW() THEN
      UPDATE tickets 
      SET status_sla = 'vencido',
          status = 'escalonado',
          escalonamento_nivel = COALESCE(escalonamento_nivel, 0) + 1
      WHERE id = ticket_record.id
        AND status_sla != 'vencido';

      PERFORM log_sla_action(
        ticket_record.id,
        'SLA vencido - Ticket escalonado',
        jsonb_build_object(
          'data_limite_original', ticket_record.data_limite_sla,
          'data_limite_efetiva', data_limite_efetiva,
          'tempo_pausado_total', ticket_record.tempo_pausado_total
        )
      );

      INSERT INTO notifications_queue (ticket_id, type, payload, status)
      SELECT 
        ticket_record.id, 'sla_breach',
        jsonb_build_object(
          'ticket_id', ticket_record.id,
          'codigo_ticket', ticket_record.codigo_ticket,
          'titulo', ticket_record.titulo
        ),
        'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications_queue
        WHERE ticket_id = ticket_record.id AND type = 'sla_breach'
      );

      notification_count := notification_count + 1;
    END IF;
  END LOOP;

  RETURN notification_count;
END;
$$;