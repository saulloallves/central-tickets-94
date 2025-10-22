-- Corrigir a função process_overdue_slas() com a coluna correta
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER := 0;
  notification_destination TEXT;
  v_ticket RECORD;
BEGIN
  -- Lock para prevenir race conditions
  LOCK TABLE notifications_queue IN EXCLUSIVE MODE;

  -- Buscar o destino configurado para notificações de SLA vencido
  SELECT fixed_value INTO notification_destination
  FROM notification_source_config
  WHERE notification_type = 'sla_breach'
    AND is_active = true
    AND source_type = 'fixed'
  LIMIT 1;

  IF notification_destination IS NULL THEN
    RAISE WARNING 'Nenhum destino configurado para notificações de SLA vencido';
    RETURN 0;
  END IF;

  RAISE LOG 'Destino para SLA breach encontrado: %', notification_destination;

  -- Processar tickets com SLA vencido
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.descricao_problema,
      t.sla_minutos_restantes,
      t.prioridade,
      t.unidade_id,
      t.status,
      u.grupo as unidade_nome,
      e.nome as equipe_nome
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id  -- ✅ CORRETO: era t.equipe_id
    WHERE t.status_sla = 'vencido'::ticket_sla_status
      AND t.status NOT IN ('concluido', 'escalonado')
      AND NOT EXISTS (
        SELECT 1 
        FROM notifications_queue nq 
        WHERE nq.ticket_id = t.id 
          AND nq.type = 'sla_breach'
          AND nq.status IN ('pending', 'processing', 'sent')
          AND nq.created_at > NOW() - INTERVAL '2 hours'
      )
  LOOP
    -- Atualizar status do ticket para escalonado
    UPDATE tickets
    SET 
      status = 'escalonado',
      escalonado_para = notification_destination,
      escalonamento_nivel = COALESCE(escalonamento_nivel, 0) + 1,
      sla_escalado_em = NOW(),
      updated_at = NOW()
    WHERE id = v_ticket.id;

    -- Criar notificação na fila
    INSERT INTO notifications_queue (type, ticket_id, payload, status)
    VALUES (
      'sla_breach',
      v_ticket.id,
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'titulo', v_ticket.titulo,
        'descricao_problema', COALESCE(LEFT(v_ticket.descricao_problema, 200), 'N/A'),
        'sla_minutos_restantes', v_ticket.sla_minutos_restantes,
        'prioridade', v_ticket.prioridade,
        'unidade_id', v_ticket.unidade_id,
        'unidade_nome', COALESCE(v_ticket.unidade_nome, 'N/A'),
        'equipe_responsavel', COALESCE(v_ticket.equipe_nome, 'Não atribuído'),
        'status', v_ticket.status,
        'destino_whatsapp', notification_destination,
        'escalado_para', notification_destination
      ),
      'pending'
    );

    -- Registrar log de escalonamento
    INSERT INTO escalation_logs (ticket_id, nivel, motivo, destino, detalhes)
    VALUES (
      v_ticket.id,
      COALESCE(v_ticket.escalonamento_nivel, 0) + 1,
      'SLA vencido - Escalonamento automático',
      notification_destination,
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'prioridade', v_ticket.prioridade,
        'sla_vencido_em', NOW()
      )
    );

    affected_count := affected_count + 1;
    RAISE LOG 'Ticket % escalonado para %', v_ticket.codigo_ticket, notification_destination;
  END LOOP;
  
  RAISE LOG 'Total de tickets escalonados: %', affected_count;
  RETURN affected_count;
END;
$$;