-- Adicionar campo para registrar quando SLA venceu
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS sla_vencido_em TIMESTAMPTZ;

COMMENT ON COLUMN public.tickets.sla_vencido_em IS 
'Timestamp de quando o SLA deste ticket venceu (sla_minutos_restantes chegou a 0). NULL = ainda não venceu ou foi pausado.';

-- Inicializar para tickets já vencidos
UPDATE public.tickets
SET sla_vencido_em = NOW()
WHERE status_sla = 'vencido'
  AND sla_vencido_em IS NULL;

-- Atualizar função process_overdue_slas para setar o timestamp
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result RECORD;
  v_ticket RECORD;
  v_notificacoes_criadas INTEGER := 0;
BEGIN
  -- Primeiro, decrementar minutos de todos os tickets ativos
  SELECT * INTO v_result FROM decrementar_sla_minutos();
  
  RAISE NOTICE '✅ Decrementados % tickets, % venceram agora', 
    v_result.tickets_atualizados, 
    v_result.tickets_vencidos;
  
  -- Processar tickets com SLA = 0 (vencidos)
  FOR v_ticket IN
    SELECT 
      id,
      codigo_ticket,
      unidade_id,
      prioridade,
      sla_minutos_restantes
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento', 'escalonado')
      AND sla_pausado = FALSE
      AND sla_pausado_mensagem = FALSE
      AND sla_minutos_restantes <= 0
      AND status_sla != 'vencido'
  LOOP
    -- Marcar como vencido E registrar timestamp
    UPDATE tickets
    SET 
      status_sla = 'vencido',
      sla_vencido_em = NOW()
    WHERE id = v_ticket.id;
    
    -- Criar notificação
    INSERT INTO notifications_queue (ticket_id, type, payload)
    VALUES (
      v_ticket.id,
      'sla_breach',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'unidade_id', v_ticket.unidade_id,
        'prioridade', v_ticket.prioridade,
        'sla_vencido_em', NOW(),
        'minutos_restantes', v_ticket.sla_minutos_restantes
      )
    )
    ON CONFLICT (ticket_id, type) 
    WHERE type IN ('sla_breach')
    DO NOTHING;
    
    v_notificacoes_criadas := v_notificacoes_criadas + 1;
  END LOOP;
  
  RETURN v_notificacoes_criadas;
END;
$$;