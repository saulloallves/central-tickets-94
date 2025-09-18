-- Criar funções para processamento automático de SLAs

-- Função para processar SLAs vencidos automaticamente
CREATE OR REPLACE FUNCTION public.process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ticket_record RECORD;
  tickets_processed INTEGER := 0;
BEGIN
  -- Buscar tickets com SLA vencido que não foram escalados ainda
  FOR ticket_record IN
    SELECT t.id, t.codigo_ticket, t.data_limite_sla, t.escalonamento_nivel, t.unidade_id, t.prioridade
    FROM public.tickets t
    WHERE t.status IN ('aberto', 'em_atendimento')
      AND t.data_limite_sla IS NOT NULL
      AND t.data_limite_sla < NOW()
      AND (t.status_sla != 'vencido' OR t.status_sla IS NULL)
  LOOP
    -- Atualizar status do ticket para escalado
    UPDATE public.tickets
    SET status = 'escalonado'::ticket_status,
        status_sla = 'vencido',
        escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel, 0), 1) + 1,
        updated_at = NOW()
    WHERE id = ticket_record.id;

    -- Criar notificação de SLA vencido para envio ao WhatsApp
    INSERT INTO public.notifications_queue (ticket_id, type, alert_level, payload, status)
    VALUES (
      ticket_record.id,
      'sla_breach',
      'critical',
      jsonb_build_object(
        'codigo_ticket', ticket_record.codigo_ticket,
        'sla_vencido_em', ticket_record.data_limite_sla,
        'escalonamento_nivel', GREATEST(COALESCE(ticket_record.escalonamento_nivel, 0), 1) + 1,
        'unidade_id', ticket_record.unidade_id,
        'prioridade', ticket_record.prioridade,
        'acao', 'escalado_automaticamente',
        'timestamp', NOW()
      ),
      'pending'
    ) ON CONFLICT (ticket_id, type) WHERE type = 'sla_breach' DO NOTHING;

    -- Log da ação
    PERFORM public.log_sla_action(
      ticket_record.id,
      'SLA vencido - Ticket escalado automaticamente',
      jsonb_build_object(
        'sla_vencido_em', ticket_record.data_limite_sla,
        'escalonamento_nivel', GREATEST(COALESCE(ticket_record.escalonamento_nivel, 0), 1) + 1,
        'processado_em', NOW(),
        'automatico', true
      )
    );

    tickets_processed := tickets_processed + 1;
  END LOOP;

  RETURN tickets_processed;
END;
$function$;

-- Função para processar avisos de 50% do SLA
CREATE OR REPLACE FUNCTION public.process_sla_half_warnings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ticket_record RECORD;
  notifications_created INTEGER := 0;
BEGIN
  -- Buscar tickets que atingiram 50% do SLA
  FOR ticket_record IN
    SELECT t.id, t.codigo_ticket, t.sla_half_time, t.unidade_id, t.prioridade
    FROM public.tickets t
    WHERE t.status IN ('aberto', 'em_atendimento')
      AND t.sla_half_time IS NOT NULL
      AND t.sla_half_time <= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications_queue nq
        WHERE nq.ticket_id = t.id AND nq.type = 'sla_half'
      )
  LOOP
    -- Criar notificação de 50% SLA
    INSERT INTO public.notifications_queue (ticket_id, type, alert_level, payload, status)
    VALUES (
      ticket_record.id,
      'sla_half',
      'warning',
      jsonb_build_object(
        'codigo_ticket', ticket_record.codigo_ticket,
        'sla_50_atingido_em', ticket_record.sla_half_time,
        'unidade_id', ticket_record.unidade_id,
        'prioridade', ticket_record.prioridade,
        'timestamp', NOW()
      ),
      'pending'
    );

    -- Log da ação
    PERFORM public.log_sla_action(
      ticket_record.id,
      'Aviso de 50% do SLA atingido',
      jsonb_build_object(
        'sla_half_time', ticket_record.sla_half_time,
        'processado_em', NOW(),
        'automatico', true
      )
    );

    notifications_created := notifications_created + 1;
  END LOOP;

  RETURN notifications_created;
END;
$function$;