-- ========================================
-- ESCALONAMENTO SIMPLES E AUTOMÁTICO
-- Quando SLA vence, ticket vai direto para 'escalonado'
-- ========================================

-- 1. Adicionar campo para registrar quando foi escalado
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS escalonado_em TIMESTAMPTZ;

-- 2. Atualizar função process_overdue_slas() para escalar automaticamente
DROP FUNCTION IF EXISTS process_overdue_slas();

CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS TABLE(notificacoes_criadas INTEGER, tickets_escalonados INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket RECORD;
  v_notificacoes_criadas INTEGER := 0;
  v_tickets_escalonados INTEGER := 0;
  v_numero_destino TEXT;
BEGIN
  RAISE NOTICE '🔍 Processando tickets vencidos para escalonamento...';

  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.prioridade,
      t.status,
      t.status_sla,
      t.sla_vencido_em,
      u.fantasy_name as unidade_nome,
      u.franqueado_nome,
      u.numero_notificacao_sla
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status_sla = 'vencido'
      AND t.status NOT IN ('concluido', 'escalonado')
      AND t.sla_vencido_em IS NOT NULL
  LOOP
    -- 1. ESCALAR O TICKET (marca como escalonado imediatamente)
    UPDATE tickets
    SET 
      status = 'escalonado',
      escalonamento_nivel = 1,
      escalonado_em = NOW(),
      updated_at = NOW()
    WHERE id = v_ticket.id;
    
    v_tickets_escalonados := v_tickets_escalonados + 1;
    RAISE NOTICE '⬆️ Ticket % escalado automaticamente', v_ticket.codigo_ticket;

    -- Log da ação
    INSERT INTO system_logs (
      level,
      message,
      metadata
    ) VALUES (
      'warning',
      format('Ticket %s escalado por vencimento de SLA', v_ticket.codigo_ticket),
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'prioridade', v_ticket.prioridade,
        'acao', 'escalamento_automatico'
      )
    );

    -- 2. CRIAR NOTIFICAÇÃO (se ainda não existe)
    v_numero_destino := COALESCE(v_ticket.numero_notificacao_sla, '5511999999999');

    INSERT INTO notifications_queue (
      type,
      ticket_id,
      destination,
      message,
      status,
      metadata
    )
    SELECT
      'sla_breach',
      v_ticket.id,
      v_numero_destino,
      format(
        '🚨 *TICKET ESCALONADO* 🚨\n\n' ||
        '*Ticket:* %s\n' ||
        '*Título:* %s\n' ||
        '*Unidade:* %s\n' ||
        '*Franqueado:* %s\n' ||
        '*Prioridade:* %s\n' ||
        '*Vencido em:* %s\n\n' ||
        '⚠️ Ação imediata necessária!',
        v_ticket.codigo_ticket,
        v_ticket.titulo,
        COALESCE(v_ticket.unidade_nome, 'N/A'),
        COALESCE(v_ticket.franqueado_nome, 'N/A'),
        v_ticket.prioridade,
        TO_CHAR(v_ticket.sla_vencido_em, 'DD/MM/YYYY HH24:MI')
      ),
      'pending',
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'prioridade', v_ticket.prioridade,
        'escalonado', true
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications_queue
      WHERE ticket_id = v_ticket.id
        AND type = 'sla_breach'
        AND status IN ('pending', 'processing')
    );

    IF FOUND THEN
      v_notificacoes_criadas := v_notificacoes_criadas + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ %s tickets escalonados, %s notificações criadas', 
    v_tickets_escalonados, v_notificacoes_criadas;
    
  RETURN QUERY SELECT v_notificacoes_criadas, v_tickets_escalonados;
END;
$$;

-- 3. Comentários explicativos
COMMENT ON FUNCTION process_overdue_slas() IS 
'Processa tickets com SLA vencido: marca como escalonado e cria notificação. Executado automaticamente via sla-processor.';

COMMENT ON COLUMN tickets.escalonado_em IS 
'Timestamp de quando o ticket foi escalado pela primeira vez por vencimento de SLA.';