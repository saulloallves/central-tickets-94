-- ============================================================================
-- CORREÇÃO COMPLETA DO SISTEMA DE ESCALONAMENTO DE SLA
-- ============================================================================
-- Problema: process_overdue_slas() usa coluna errada (whatsapp_group_id ao invés de grupo_whatsapp_id)
-- Solução: Corrigir todas as funções afetadas e simplificar escalonamento
-- ============================================================================

-- 1. CORRIGIR E SIMPLIFICAR process_overdue_slas()
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tickets_afetados INTEGER := 0;
  v_ticket RECORD;
BEGIN
  RAISE NOTICE '🔍 Iniciando processamento de SLAs vencidos...';

  -- Buscar tickets com SLA vencido que ainda não foram marcados
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.status,
      t.sla_minutos_restantes,
      t.unidade_id,
      u.grupo_whatsapp_id,
      u.grupo as unidade_nome
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status IN ('aberto', 'em_atendimento')
      AND t.sla_pausado = FALSE
      AND t.sla_pausado_mensagem = FALSE
      AND (
        (t.sla_minutos_restantes IS NOT NULL AND t.sla_minutos_restantes <= 0)
        OR (t.data_limite_sla IS NOT NULL AND NOW() >= t.data_limite_sla)
      )
      AND t.status_sla != 'vencido'
  LOOP
    -- Marcar como vencido e escalonado
    UPDATE tickets
    SET 
      status_sla = 'vencido',
      status = 'escalonado',
      updated_at = NOW()
    WHERE id = v_ticket.id;

    -- Criar notificação de SLA vencido
    INSERT INTO notifications_queue (ticket_id, type, payload, status)
    VALUES (
      v_ticket.id,
      'sla_breach',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'unidade_id', v_ticket.unidade_id,
        'unidade_nome', v_ticket.unidade_nome,
        'grupo_whatsapp_id', v_ticket.grupo_whatsapp_id,
        'sla_vencido_em', NOW()
      ),
      'pending'
    )
    ON CONFLICT (ticket_id, type) WHERE type IN ('sla_breach') DO NOTHING;

    v_tickets_afetados := v_tickets_afetados + 1;

    RAISE NOTICE '⏰ Ticket % (%) - SLA vencido! Status alterado para ESCALONADO', 
      v_ticket.codigo_ticket, v_ticket.id;
  END LOOP;

  RAISE NOTICE '✅ Total de tickets escalonados: %', v_tickets_afetados;
  RETURN v_tickets_afetados;
END;
$$;

-- 2. SIMPLIFICAR O TRIGGER tickets_sla_monitor
CREATE OR REPLACE FUNCTION tickets_sla_monitor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas logar quando SLA vencer
  IF NEW.status_sla = 'vencido' AND (OLD.status_sla IS DISTINCT FROM 'vencido') THEN
    
    -- Se ticket está em aberto ou em atendimento, escalonar
    IF NEW.status IN ('aberto', 'em_atendimento') THEN
      NEW.status := 'escalonado';
      
      RAISE NOTICE '🚨 TICKET ESCALONADO: % - SLA vencido (estava em: %)', 
        NEW.codigo_ticket, OLD.status;
      
      -- Log da ação
      PERFORM log_sla_action(
        NEW.id,
        'SLA Vencido - Ticket Escalonado',
        jsonb_build_object(
          'status_anterior', OLD.status,
          'status_novo', 'escalonado',
          'sla_minutos_restantes', NEW.sla_minutos_restantes
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. ATUALIZAR decrementar_sla_minutos() para remover escalonamento_nivel
CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS TABLE(tickets_atualizados integer, tickets_vencidos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_minutos_decorridos INTEGER;
  v_tickets_atualizados INTEGER := 0;
  v_tickets_vencidos INTEGER := 0;
BEGIN
  -- Processar apenas tickets ativos e NÃO pausados
  FOR v_ticket IN
    SELECT 
      id,
      sla_minutos_restantes,
      sla_ultima_atualizacao,
      codigo_ticket,
      status
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento')
      AND sla_pausado = FALSE
      AND sla_pausado_mensagem = FALSE
      AND sla_minutos_restantes IS NOT NULL
      AND sla_minutos_restantes > 0
  LOOP
    -- Calcular quantos minutos se passaram desde última atualização
    v_minutos_decorridos := EXTRACT(EPOCH FROM (NOW() - v_ticket.sla_ultima_atualizacao)) / 60;
    
    -- Se passou pelo menos 1 minuto, atualizar
    IF v_minutos_decorridos >= 1 THEN
      UPDATE tickets
      SET 
        sla_minutos_restantes = GREATEST(0, sla_minutos_restantes - v_minutos_decorridos::INTEGER),
        sla_ultima_atualizacao = NOW(),
        status_sla = CASE
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER) <= 0 THEN 'vencido'
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER)::DECIMAL / NULLIF(sla_minutos_totais, 0) < 0.5 THEN 'alerta'
          ELSE 'dentro_prazo'
        END
      WHERE id = v_ticket.id;
      
      v_tickets_atualizados := v_tickets_atualizados + 1;
      
      -- Verificar se venceu agora
      IF (v_ticket.sla_minutos_restantes - v_minutos_decorridos) <= 0 THEN
        v_tickets_vencidos := v_tickets_vencidos + 1;
        
        RAISE NOTICE '⏱️ SLA VENCIDO: Ticket % - minutos restantes: %', 
          v_ticket.codigo_ticket, 
          (v_ticket.sla_minutos_restantes - v_minutos_decorridos);
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_tickets_atualizados, v_tickets_vencidos;
END;
$$;

-- 4. FUNÇÃO DE CORREÇÃO RETROATIVA
CREATE OR REPLACE FUNCTION corrigir_tickets_sla_vencido()
RETURNS TABLE(tickets_corrigidos integer, detalhes jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_corrigidos INTEGER := 0;
  v_detalhes JSONB := '[]'::jsonb;
BEGIN
  RAISE NOTICE '🔧 Iniciando correção retroativa de tickets com SLA vencido...';

  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.status,
      t.status_sla,
      t.sla_minutos_restantes
    FROM tickets t
    WHERE t.status IN ('aberto', 'em_atendimento')
      AND (
        t.status_sla = 'vencido'
        OR (t.sla_minutos_restantes IS NOT NULL AND t.sla_minutos_restantes <= 0)
        OR (t.data_limite_sla IS NOT NULL AND NOW() >= t.data_limite_sla)
      )
  LOOP
    -- Atualizar para escalonado
    UPDATE tickets
    SET 
      status = 'escalonado',
      status_sla = 'vencido',
      updated_at = NOW()
    WHERE id = v_ticket.id;

    v_corrigidos := v_corrigidos + 1;
    
    v_detalhes := v_detalhes || jsonb_build_object(
      'ticket_id', v_ticket.id,
      'codigo_ticket', v_ticket.codigo_ticket,
      'status_anterior', v_ticket.status,
      'status_sla', v_ticket.status_sla,
      'sla_minutos_restantes', v_ticket.sla_minutos_restantes
    );

    RAISE NOTICE '✅ Corrigido: % (%) - % → escalonado', 
      v_ticket.codigo_ticket, v_ticket.id, v_ticket.status;
  END LOOP;

  RAISE NOTICE '🎯 Total de tickets corrigidos: %', v_corrigidos;
  
  RETURN QUERY SELECT v_corrigidos, v_detalhes;
END;
$$;

-- 5. EXECUTAR CORREÇÃO RETROATIVA
DO $$
DECLARE
  v_resultado RECORD;
BEGIN
  SELECT * INTO v_resultado FROM corrigir_tickets_sla_vencido();
  RAISE NOTICE '📊 Resultado da correção: % tickets corrigidos', v_resultado.tickets_corrigidos;
END $$;

-- 6. COMENTÁRIOS E DOCUMENTAÇÃO
COMMENT ON FUNCTION process_overdue_slas() IS 
  'Processa tickets com SLA vencido e muda status para escalonado. Corrigido para usar grupo_whatsapp_id.';

COMMENT ON FUNCTION tickets_sla_monitor() IS 
  'Trigger simplificado que apenas muda status para escalonado quando SLA vence. Sem níveis de escalonamento.';

COMMENT ON FUNCTION decrementar_sla_minutos() IS 
  'Decrementa SLA em minutos para tickets ativos. Versão simplificada sem escalonamento_nivel.';

COMMENT ON FUNCTION corrigir_tickets_sla_vencido() IS 
  'Função de correção retroativa para tickets que deveriam estar escalonados mas não foram processados corretamente.';