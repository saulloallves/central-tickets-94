-- ============================================================================
-- MIGRAÇÃO: Remover dependência de data_limite_sla e sla_half_time
-- Usar APENAS sla_minutos_restantes como fonte única de verdade
-- ============================================================================

-- 1. DROP da função antiga para poder recriar com nova assinatura
DROP FUNCTION IF EXISTS process_sla_half_warnings();

-- 2. CRIAR nova versão usando sla_minutos_restantes
CREATE OR REPLACE FUNCTION process_sla_half_warnings()
RETURNS TABLE(
  tickets_notificados INTEGER,
  detalhes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_ticket RECORD;
  v_count INTEGER := 0;
  v_details JSONB := '[]'::jsonb;
BEGIN
  -- Buscar tickets que atingiram 50% do SLA (baseado em minutos restantes)
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.sla_minutos_restantes,
      t.sla_minutos_totais,
      t.status,
      t.unidade_id,
      t.prioridade
    FROM tickets t
    WHERE t.status IN ('aberto', 'em_atendimento', 'escalonado')
      AND t.sla_pausado = FALSE
      AND t.sla_pausado_mensagem = FALSE
      AND t.sla_minutos_restantes IS NOT NULL
      AND t.sla_minutos_totais IS NOT NULL
      -- ✅ 50% = metade dos minutos totais
      AND t.sla_minutos_restantes <= (t.sla_minutos_totais / 2)
      -- ✅ Ainda não enviou notificação de 50%
      AND NOT EXISTS (
        SELECT 1 FROM notifications_queue nq
        WHERE nq.ticket_id = t.id
          AND nq.type = 'sla_half'
          AND nq.status IN ('pending', 'processing', 'processed')
      )
  LOOP
    -- Criar notificação de 50% do SLA
    INSERT INTO notifications_queue (ticket_id, type, payload, status)
    VALUES (
      v_ticket.id,
      'sla_half',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'sla_minutos_restantes', v_ticket.sla_minutos_restantes,
        'sla_minutos_totais', v_ticket.sla_minutos_totais,
        'percentual_consumido', ROUND((1 - (v_ticket.sla_minutos_restantes::DECIMAL / v_ticket.sla_minutos_totais)) * 100, 2),
        'unidade_id', v_ticket.unidade_id,
        'prioridade', v_ticket.prioridade
      ),
      'pending'
    );
    
    v_count := v_count + 1;
    v_details := v_details || jsonb_build_object(
      'ticket_id', v_ticket.id,
      'codigo_ticket', v_ticket.codigo_ticket,
      'minutos_restantes', v_ticket.sla_minutos_restantes
    );
  END LOOP;
  
  RETURN QUERY SELECT v_count, v_details;
END;
$$;

-- 3. Log da migração
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema'::log_tipo,
  'sla_system',
  gen_random_uuid()::TEXT,
  'Migração SLA: Removida dependência de data_limite_sla e sla_half_time',
  jsonb_build_object(
    'mudanca', 'Agora usando apenas sla_minutos_restantes como fonte de verdade',
    'data', now()
  ),
  'web'::log_canal
);