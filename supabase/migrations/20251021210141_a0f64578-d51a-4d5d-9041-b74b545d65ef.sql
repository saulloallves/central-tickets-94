-- Drop e recria a função process_overdue_slas com lock exclusivo para prevenir race conditions
DROP FUNCTION IF EXISTS process_overdue_slas();

CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  -- ✅ LOCK EXCLUSIVO: Previne race conditions entre múltiplas execuções simultâneas
  LOCK TABLE notifications_queue IN EXCLUSIVE MODE;

  -- Criar notificações apenas para tickets vencidos que ainda não têm notificação pendente/processada
  INSERT INTO notifications_queue (type, ticket_id, payload, status)
  SELECT 
    'sla_breach' as type,
    t.id as ticket_id,
    jsonb_build_object(
      'codigo_ticket', t.codigo_ticket,
      'titulo', t.titulo,
      'sla_minutos_restantes', t.sla_minutos_restantes,
      'prioridade', t.prioridade,
      'unidade_id', t.unidade_id
    ) as payload,
    'pending' as status
  FROM tickets t
  WHERE t.status_sla = 'vencido'
    AND t.status != 'concluido'
    AND NOT EXISTS (
      SELECT 1 
      FROM notifications_queue nq 
      WHERE nq.ticket_id = t.id 
        AND nq.type = 'sla_breach'
        AND nq.status IN ('pending', 'processing', 'sent')
        AND nq.created_at > NOW() - INTERVAL '2 hours'
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN affected_count;
END;
$$;