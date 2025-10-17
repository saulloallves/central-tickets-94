-- ============================================================================
-- CORREÇÃO CRÍTICA: Sistema de SLA - Respeitar Pausas
-- ============================================================================
-- Este migration corrige o bug onde SLAs venciam prematuramente porque
-- a função decrementar_sla_minutos não considerava tickets pausados.
-- ============================================================================

-- 1. Dropar função antiga se existir
DROP FUNCTION IF EXISTS process_overdue_slas();

-- 2. Recriar função decrementar_sla_minutos com lógica de pausa
CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS TABLE(tickets_atualizados INT, tickets_vencidos INT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tickets_atualizados INT := 0;
  v_tickets_vencidos INT := 0;
  v_tickets_pausados INT := 0;
BEGIN
  -- =========================================================================
  -- PASSO 1: Decrementar APENAS tickets ATIVOS (não pausados)
  -- =========================================================================
  UPDATE tickets
  SET 
    sla_minutos_restantes = GREATEST(0, sla_minutos_restantes - 1),
    sla_ultima_atualizacao = NOW()
  WHERE 
    -- Ticket deve estar em status que permite SLA
    status != 'concluido'::ticket_status
    -- Ainda tem SLA para decrementar
    AND sla_minutos_restantes > 0
    -- NÃO está pausado manualmente
    AND COALESCE(sla_pausado, FALSE) = FALSE
    -- NÃO está pausado aguardando resposta do franqueado
    AND COALESCE(sla_pausado_mensagem, FALSE) = FALSE
    -- NÃO está pausado por horário comercial
    AND COALESCE(sla_pausado_horario, FALSE) = FALSE;
  
  GET DIAGNOSTICS v_tickets_atualizados = ROW_COUNT;
  
  -- =========================================================================
  -- PASSO 2: Acumular tempo pausado para tickets pausados
  -- =========================================================================
  UPDATE tickets
  SET 
    tempo_pausado_total = COALESCE(tempo_pausado_total, INTERVAL '0') + INTERVAL '1 minute',
    sla_ultima_atualizacao = NOW()
  WHERE 
    status != 'concluido'::ticket_status
    AND (
      COALESCE(sla_pausado, FALSE) = TRUE
      OR COALESCE(sla_pausado_mensagem, FALSE) = TRUE
      OR COALESCE(sla_pausado_horario, FALSE) = TRUE
    );
  
  GET DIAGNOSTICS v_tickets_pausados = ROW_COUNT;
  
  -- =========================================================================
  -- PASSO 3: Marcar tickets como vencidos (apenas os que REALMENTE venceram)
  -- =========================================================================
  UPDATE tickets
  SET 
    status_sla = 'vencido'::sla_status,
    sla_ultima_atualizacao = NOW()
  WHERE 
    sla_minutos_restantes = 0
    AND status != 'concluido'::ticket_status
    AND status_sla != 'vencido'::sla_status
    -- Garantir que não está pausado
    AND COALESCE(sla_pausado, FALSE) = FALSE
    AND COALESCE(sla_pausado_mensagem, FALSE) = FALSE
    AND COALESCE(sla_pausado_horario, FALSE) = FALSE;
  
  GET DIAGNOSTICS v_tickets_vencidos = ROW_COUNT;
  
  -- Log para debug
  RAISE NOTICE 'SLA Processor: % atualizados, % pausados, % vencidos', 
    v_tickets_atualizados, v_tickets_pausados, v_tickets_vencidos;
  
  RETURN QUERY SELECT v_tickets_atualizados, v_tickets_vencidos;
END;
$$;

-- ============================================================================
-- 3. Criar função para processar SLAs vencidos (notificações)
-- ============================================================================
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket RECORD;
  v_tickets_processados INT := 0;
BEGIN
  -- Buscar tickets vencidos que precisam de notificação
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.unidade_id,
      t.equipe_responsavel_id,
      t.prioridade,
      t.sla_minutos_restantes
    FROM tickets t
    WHERE 
      t.status_sla = 'vencido'::sla_status
      AND t.status != 'concluido'::ticket_status
      -- Não está pausado
      AND COALESCE(t.sla_pausado, FALSE) = FALSE
      AND COALESCE(t.sla_pausado_mensagem, FALSE) = FALSE
      AND COALESCE(t.sla_pausado_horario, FALSE) = FALSE
      -- Não tem notificação de SLA breach pendente/enviada nas últimas 2 horas
      AND NOT EXISTS (
        SELECT 1 FROM notifications_queue nq
        WHERE nq.ticket_id = t.id
          AND nq.type = 'sla_breach'
          AND nq.created_at > NOW() - INTERVAL '2 hours'
      )
    LIMIT 50
  LOOP
    -- Criar notificação de SLA vencido
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
        'prioridade', v_ticket.prioridade,
        'minutos_vencidos', ABS(v_ticket.sla_minutos_restantes)
      ),
      'pending'
    )
    ON CONFLICT (ticket_id, type) 
    WHERE type IN ('sla_breach')
    DO NOTHING;
    
    v_tickets_processados := v_tickets_processados + 1;
  END LOOP;
  
  RETURN v_tickets_processados;
END;
$$;

-- ============================================================================
-- 4. Adicionar índices para performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_sla_processing 
ON tickets(status, status_sla, sla_pausado, sla_pausado_mensagem, sla_pausado_horario)
WHERE status != 'concluido'::ticket_status;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_restantes 
ON tickets(sla_minutos_restantes)
WHERE status != 'concluido'::ticket_status AND sla_minutos_restantes >= 0;

-- ============================================================================
-- 5. Log da migration
-- ============================================================================
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema',
  'sla_processor',
  gen_random_uuid()::TEXT,
  'Migration: Correção crítica do sistema de SLA - respeitar pausas',
  jsonb_build_object(
    'funcoes_atualizadas', ARRAY['decrementar_sla_minutos', 'process_overdue_slas'],
    'bug_corrigido', 'SLA vencendo prematuramente em tickets pausados',
    'impacto', 'Todos os tickets agora respeitam pausas (manual, mensagem, horário comercial)'
  ),
  'painel_interno'
);