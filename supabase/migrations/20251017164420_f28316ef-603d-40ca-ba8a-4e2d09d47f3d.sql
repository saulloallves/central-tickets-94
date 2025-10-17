-- ============================================
-- CORREÇÃO DO SISTEMA DE NOTIFICAÇÕES SLA
-- ============================================

-- CORREÇÃO 1: Corrigir função decrementar_sla_minutos com cast explícito
CREATE OR REPLACE FUNCTION public.decrementar_sla_minutos()
RETURNS TABLE(tickets_atualizados integer, tickets_vencidos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket RECORD;
  v_minutos_decorridos INTEGER;
  v_tickets_atualizados INTEGER := 0;
  v_tickets_vencidos INTEGER := 0;
BEGIN
  FOR v_ticket IN
    SELECT 
      id,
      sla_minutos_restantes,
      sla_ultima_atualizacao,
      codigo_ticket,
      status
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento', 'escalonado')
      AND status != 'concluido'  -- ✅ NUNCA processar concluídos
      AND sla_pausado = FALSE
      AND sla_pausado_mensagem = FALSE
      AND sla_pausado_horario = FALSE
      AND sla_minutos_restantes IS NOT NULL
      AND sla_minutos_restantes > 0
      AND sla_ultima_atualizacao IS NOT NULL
  LOOP
    v_minutos_decorridos := EXTRACT(EPOCH FROM (NOW() - v_ticket.sla_ultima_atualizacao)) / 60;
    
    IF v_minutos_decorridos >= 1 THEN
      UPDATE tickets
      SET 
        sla_minutos_restantes = GREATEST(0, sla_minutos_restantes - v_minutos_decorridos::INTEGER),
        sla_ultima_atualizacao = NOW(),
        -- ✅ CORREÇÃO: Cast explícito para ticket_sla_status
        status_sla = CASE
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER) <= 0 THEN 'vencido'::ticket_sla_status
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER)::DECIMAL / NULLIF(sla_minutos_totais, 0) < 0.5 THEN 'alerta'::ticket_sla_status
          ELSE 'dentro_prazo'::ticket_sla_status
        END
      WHERE id = v_ticket.id
        AND status != 'concluido';  -- ✅ Proteção extra
      
      v_tickets_atualizados := v_tickets_atualizados + 1;
      
      IF (v_ticket.sla_minutos_restantes - v_minutos_decorridos) <= 0 THEN
        v_tickets_vencidos := v_tickets_vencidos + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_tickets_atualizados, v_tickets_vencidos;
END;
$function$;

-- CORREÇÃO 2: Corrigir função process_overdue_slas
CREATE OR REPLACE FUNCTION public.process_overdue_slas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket RECORD;
  v_processed INTEGER := 0;
BEGIN
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.status,
      t.status_sla,
      t.sla_minutos_restantes,
      t.prioridade
    FROM tickets t
    WHERE t.status_sla = 'vencido'::ticket_sla_status
      AND t.status IN ('aberto', 'em_atendimento', 'escalonado')
      -- ✅ NUNCA processar tickets concluídos
      AND t.status != 'concluido'
      AND t.sla_pausado = FALSE
      AND t.sla_pausado_mensagem = FALSE
      AND t.sla_pausado_horario = FALSE
  LOOP
    -- ✅ Validação extra: verificar status antes de criar notificação
    IF v_ticket.status != 'concluido' THEN
      -- Criar notificação apenas se não existir
      INSERT INTO notifications_queue (ticket_id, type, payload, status)
      SELECT 
        v_ticket.id,
        'sla_breach',
        jsonb_build_object(
          'codigo_ticket', v_ticket.codigo_ticket,
          'prioridade', v_ticket.prioridade,
          'minutos_restantes', v_ticket.sla_minutos_restantes
        ),
        'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications_queue
        WHERE ticket_id = v_ticket.id
          AND type = 'sla_breach'
          AND status IN ('pending', 'processing', 'sent')
      );
      
      v_processed := v_processed + 1;
    END IF;
  END LOOP;
  
  RETURN v_processed;
END;
$function$;

-- CORREÇÃO 3: Criar trigger de validação para prevenir notificações inválidas
CREATE OR REPLACE FUNCTION public.validate_sla_breach_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_status ticket_status;
BEGIN
  -- Validar apenas notificações de SLA
  IF NEW.type IN ('sla_breach', 'sla_half') THEN
    -- Buscar status atual do ticket
    SELECT status INTO v_ticket_status
    FROM tickets
    WHERE id = NEW.ticket_id;
    
    -- Bloquear se ticket estiver concluído
    IF v_ticket_status = 'concluido' THEN
      RAISE NOTICE 'Bloqueando notificação % para ticket % com status %', 
        NEW.type, NEW.ticket_id, v_ticket_status;
      RETURN NULL;  -- Cancela o INSERT
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar o trigger
DROP TRIGGER IF EXISTS validate_sla_notifications ON notifications_queue;
CREATE TRIGGER validate_sla_notifications
  BEFORE INSERT ON notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION validate_sla_breach_notification();

-- CORREÇÃO 4: Limpar notificações inválidas existentes
DELETE FROM notifications_queue
WHERE type IN ('sla_breach', 'sla_half')
  AND ticket_id IN (
    SELECT id FROM tickets 
    WHERE status = 'concluido'
  )
  AND status IN ('pending', 'processing');

-- Log da limpeza
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Removidas % notificações inválidas de tickets concluídos', v_deleted_count;
END $$;