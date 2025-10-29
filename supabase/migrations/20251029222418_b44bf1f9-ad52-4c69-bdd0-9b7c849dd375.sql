-- CORREÇÃO: Remover referências a colunas inexistentes e valores de enum inválidos

-- 1. Recriar process_overdue_slas() SEM franqueado_nome
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
      u.numero_notificacao_sla
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status_sla = 'vencido'
      AND t.status NOT IN ('concluido', 'escalonado')
      AND t.sla_vencido_em IS NOT NULL
  LOOP
    -- Escalar o ticket
    UPDATE tickets
    SET 
      status = 'escalonado',
      escalonamento_nivel = 1,
      escalonado_em = NOW(),
      updated_at = NOW()
    WHERE id = v_ticket.id;
    
    v_tickets_escalonados := v_tickets_escalonados + 1;
    RAISE NOTICE '⬆️ Ticket % escalado', v_ticket.codigo_ticket;

    -- Log
    INSERT INTO system_logs (
      level, message, metadata
    ) VALUES (
      'warning',
      format('Ticket %s escalado por SLA vencido', v_ticket.codigo_ticket),
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'prioridade', v_ticket.prioridade
      )
    );

    -- Criar notificação (SEM franqueado_nome)
    v_numero_destino := COALESCE(v_ticket.numero_notificacao_sla, '5511999999999');

    INSERT INTO notifications_queue (
      type, ticket_id, destination, message, status, metadata
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
        '*Prioridade:* %s\n' ||
        '*Vencido em:* %s\n\n' ||
        '⚠️ Ação imediata necessária!',
        v_ticket.codigo_ticket,
        v_ticket.titulo,
        COALESCE(v_ticket.unidade_nome, 'N/A'),
        v_ticket.prioridade,
        TO_CHAR(v_ticket.sla_vencido_em, 'DD/MM/YYYY HH24:MI')
      ),
      'pending',
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
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

  RAISE NOTICE '✅ %s tickets escalonados, %s notificações', 
    v_tickets_escalonados, v_notificacoes_criadas;
    
  RETURN QUERY SELECT v_notificacoes_criadas, v_tickets_escalonados;
END;
$$;

-- 2. Garantir que decrementar_sla_minutos() use apenas valores válidos
DROP FUNCTION IF EXISTS decrementar_sla_minutos();

CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tickets_atualizados INTEGER := 0;
  v_tickets_vencidos INTEGER := 0;
BEGIN
  UPDATE tickets
  SET 
    sla_minutos_restantes = sla_minutos_restantes - 1,
    status_sla = CASE
      WHEN sla_minutos_restantes - 1 <= 0 THEN 'vencido'::ticket_sla_status
      WHEN sla_minutos_restantes - 1 <= (sla_minutos_totais * 0.2) THEN 'alerta'::ticket_sla_status
      ELSE 'dentro_prazo'::ticket_sla_status
    END,
    sla_vencido_em = CASE
      WHEN sla_minutos_restantes - 1 <= 0 AND sla_vencido_em IS NULL THEN NOW()
      ELSE sla_vencido_em
    END,
    updated_at = NOW()
  WHERE 
    status NOT IN ('concluido', 'escalonado')
    AND sla_pausado = false
    AND sla_pausado_mensagem = false
    AND sla_pausado_horario = false
    AND sla_minutos_restantes > -1440;

  GET DIAGNOSTICS v_tickets_atualizados = ROW_COUNT;
  
  SELECT COUNT(*) INTO v_tickets_vencidos
  FROM tickets
  WHERE status_sla = 'vencido'
    AND status NOT IN ('concluido', 'escalonado');

  RETURN jsonb_build_object(
    'tickets_atualizados', v_tickets_atualizados,
    'tickets_vencidos', v_tickets_vencidos
  );
END;
$$;

COMMENT ON FUNCTION decrementar_sla_minutos() IS 
'Decrementa SLA usando apenas valores válidos do enum: dentro_prazo, alerta, vencido';
