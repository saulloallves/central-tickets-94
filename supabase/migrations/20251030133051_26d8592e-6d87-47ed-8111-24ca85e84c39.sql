-- Correção: process_overdue_slas() usar notification_source_config
-- Remove referências à coluna inexistente numero_notificacao_sla
-- Usa fixed_value configurado: 120363421372736067-group

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
  v_source_config RECORD;
BEGIN
  -- Buscar configuração ativa de sla_breach
  SELECT * INTO v_source_config
  FROM notification_source_config
  WHERE notification_type = 'sla_breach'
    AND is_active = true
  LIMIT 1;

  RAISE NOTICE '🔍 Processando tickets vencidos para escalonamento...';
  
  IF v_source_config.id IS NOT NULL THEN
    RAISE NOTICE '📋 Config encontrada: source_type=%, fixed_value=%', 
      v_source_config.source_type, v_source_config.fixed_value;
  ELSE
    RAISE NOTICE '⚠️ Nenhuma configuração ativa de sla_breach encontrada';
  END IF;

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
      u.id_grupo_notificacoes
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status_sla = 'vencido'
      AND t.status NOT IN ('concluido', 'escalonado')
      AND t.sla_vencido_em IS NOT NULL
  LOOP
    -- Determinar número de destino baseado na configuração
    IF v_source_config.source_type = 'fixed' AND v_source_config.fixed_value IS NOT NULL THEN
      v_numero_destino := v_source_config.fixed_value;
      RAISE NOTICE '📱 Usando número fixo da config: %', v_numero_destino;
    ELSIF v_source_config.source_type = 'column' AND v_source_config.source_column IS NOT NULL THEN
      v_numero_destino := v_ticket.id_grupo_notificacoes;
      RAISE NOTICE '📱 Usando coluna %: %', v_source_config.source_column, v_numero_destino;
    ELSE
      v_numero_destino := COALESCE(v_ticket.id_grupo_notificacoes, '5511999999999');
      RAISE NOTICE '📱 Usando fallback: %', v_numero_destino;
    END IF;

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

    -- Registrar no log do sistema
    INSERT INTO system_logs (
      level, 
      message, 
      metadata
    ) VALUES (
      'warning',
      format('Ticket %s escalado por SLA vencido', v_ticket.codigo_ticket),
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'prioridade', v_ticket.prioridade,
        'destino', v_numero_destino,
        'config_type', v_source_config.source_type
      )
    );

    -- Criar notificação de SLA vencido
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
        'escalonado', true,
        'destino_config', v_source_config.source_type
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications_queue
      WHERE ticket_id = v_ticket.id
        AND type = 'sla_breach'
        AND status IN ('pending', 'processing')
    );

    IF FOUND THEN
      v_notificacoes_criadas := v_notificacoes_criadas + 1;
      RAISE NOTICE '📨 Notificação criada para destino: %', v_numero_destino;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Processamento concluído: %s tickets escalonados, %s notificações criadas', 
    v_tickets_escalonados, v_notificacoes_criadas;
    
  RETURN QUERY SELECT v_notificacoes_criadas, v_tickets_escalonados;
END;
$$;

COMMENT ON FUNCTION process_overdue_slas() IS 
'Processa tickets com SLA vencido, usa notification_source_config para determinar destino das notificações';