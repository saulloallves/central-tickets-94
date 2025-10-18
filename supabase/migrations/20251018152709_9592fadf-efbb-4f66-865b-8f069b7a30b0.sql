-- ============================================================================
-- FASE 1: LIMPEZA DE DADOS CORROMPIDOS
-- ============================================================================
-- Resetar tempo_pausado_total para tickets ativos com valores suspeitos (>2h)

UPDATE tickets
SET tempo_pausado_total = INTERVAL '0'
WHERE status != 'concluido'
  AND EXTRACT(EPOCH FROM tempo_pausado_total)/60 > 120;

-- Log da ação
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema',
  'tickets',
  'limpeza_sla',
  'Limpeza de dados corrompidos de tempo_pausado_total',
  jsonb_build_object(
    'descricao', 'Resetados tickets com tempo_pausado_total > 2h',
    'timestamp', NOW()
  ),
  'web'
);

-- ============================================================================
-- FASE 2: CORREÇÃO DA FUNÇÃO decrementar_sla_minutos
-- ============================================================================
-- PROBLEMA: Estava incrementando tempo_pausado_total a cada minuto para tickets pausados
-- CORREÇÃO: REMOVER essa lógica - tempo pausado deve ser calculado apenas ao despausar

DROP FUNCTION IF EXISTS decrementar_sla_minutos() CASCADE;

CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS TABLE(tickets_atualizados INT, tickets_vencidos INT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tickets_atualizados INT := 0;
  v_tickets_vencidos INT := 0;
BEGIN
  -- ✅ PASSO 1: Decrementar APENAS tickets NÃO pausados
  UPDATE tickets
  SET 
    sla_minutos_restantes = GREATEST(0, sla_minutos_restantes - 1),
    sla_ultima_atualizacao = NOW(),
    -- ✅ CORREÇÃO: Marcar como vencido se chegou a zero
    status_sla = CASE 
      WHEN sla_minutos_restantes <= 1 THEN 'vencido'::sla_status
      ELSE status_sla
    END,
    -- ✅ CORREÇÃO: Registrar timestamp de vencimento
    sla_vencido_em = CASE 
      WHEN sla_minutos_restantes <= 1 AND sla_vencido_em IS NULL THEN NOW()
      ELSE sla_vencido_em
    END
  WHERE 
    status NOT IN ('concluido'::ticket_status)
    AND sla_minutos_restantes > 0
    -- ✅ CRÍTICO: Não decrementar se qualquer tipo de pausa estiver ativa
    AND COALESCE(sla_pausado, FALSE) = FALSE
    AND COALESCE(sla_pausado_mensagem, FALSE) = FALSE
    AND COALESCE(sla_pausado_horario, FALSE) = FALSE;
    
  GET DIAGNOSTICS v_tickets_atualizados = ROW_COUNT;
  
  -- ✅ PASSO 2: Contar quantos venceram NESTE ciclo
  SELECT COUNT(*)::INT INTO v_tickets_vencidos
  FROM tickets
  WHERE status_sla = 'vencido'::sla_status
    AND sla_vencido_em >= NOW() - INTERVAL '2 minutes';
  
  RAISE NOTICE '✅ decrementar_sla_minutos: % tickets atualizados, % venceram', 
    v_tickets_atualizados, v_tickets_vencidos;
  
  RETURN QUERY SELECT v_tickets_atualizados, v_tickets_vencidos;
END;
$$;

-- ============================================================================
-- FASE 3: CORREÇÃO DA FUNÇÃO process_overdue_slas
-- ============================================================================
-- PROBLEMA: Tickets pausados com SLA vencido nunca eram escalonados
-- CORREÇÃO: REMOVER filtros de pausa - se venceu, deve escalonar

DROP FUNCTION IF EXISTS process_overdue_slas() CASCADE;

CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_notificacoes_criadas INT := 0;
  v_ticket RECORD;
BEGIN
  RAISE NOTICE '🔍 process_overdue_slas: Buscando tickets vencidos...';

  -- ✅ CRÍTICO: Buscar TODOS os tickets vencidos, MESMO SE pausados
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.prioridade,
      t.unidade_id,
      t.equipe_responsavel_id,
      t.sla_minutos_restantes,
      t.sla_pausado,
      t.sla_pausado_mensagem,
      t.sla_pausado_horario
    FROM tickets t
    WHERE 
      t.status_sla = 'vencido'::sla_status
      AND t.status != 'concluido'::ticket_status
      -- ✅ CORREÇÃO: REMOVER filtros de pausa
      -- Se o SLA venceu, deve ser escalado independentemente de estar pausado
    ORDER BY t.sla_vencido_em ASC
    LIMIT 50
  LOOP
    -- Criar/atualizar notificação de SLA vencido
    INSERT INTO notifications_queue (
      ticket_id,
      type,
      alert_level,
      payload,
      status
    ) VALUES (
      v_ticket.id,
      'sla_breach',
      'critical',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'titulo', v_ticket.titulo,
        'prioridade', v_ticket.prioridade,
        'sla_minutos_restantes', v_ticket.sla_minutos_restantes,
        'pausado', v_ticket.sla_pausado,
        'pausado_mensagem', v_ticket.sla_pausado_mensagem,
        'pausado_horario', v_ticket.sla_pausado_horario
      ),
      'pending'
    )
    ON CONFLICT (ticket_id, type) 
    WHERE type IN ('sla_breach')
    DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW();
    
    v_notificacoes_criadas := v_notificacoes_criadas + 1;
    
    RAISE NOTICE '🚨 SLA Vencido: Ticket % (pausado: %, msg: %, horário: %)',
      v_ticket.codigo_ticket,
      v_ticket.sla_pausado,
      v_ticket.sla_pausado_mensagem,
      v_ticket.sla_pausado_horario;
  END LOOP;

  RAISE NOTICE '✅ process_overdue_slas: % notificações criadas/atualizadas', v_notificacoes_criadas;
  
  RETURN v_notificacoes_criadas;
END;
$$;