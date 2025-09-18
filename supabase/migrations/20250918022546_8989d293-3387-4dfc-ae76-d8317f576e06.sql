-- Corrigir o escalonamento automático para garantir que tickets "parados" com SLA vencido sejam processados
-- O problema: tickets que ficam em 'aberto' com SLA vencido não são atualizados, então o trigger não dispara

-- Melhorar a função process_overdue_slas para forçar o escalonamento diretamente
CREATE OR REPLACE FUNCTION public.process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tickets_updated INTEGER := 0;
  ticket_record RECORD;
BEGIN
  -- Buscar tickets com SLA vencido que precisam ser processados
  FOR ticket_record IN
    SELECT id, codigo_ticket, data_limite_sla, status, status_sla, escalonamento_nivel
    FROM public.tickets
    WHERE data_limite_sla < NOW()
      AND status IN ('aberto', 'em_atendimento')  -- Apenas tickets que podem ser escalonados
      AND status_sla != 'vencido'  -- Que ainda não foram marcados como vencidos
  LOOP
    -- Atualizar DIRETO para escalonado + status_sla vencido em uma única operação
    -- Isso vai disparar o trigger uma só vez com ambas as mudanças
    UPDATE public.tickets 
    SET status = 'escalonado'::ticket_status,
        status_sla = 'vencido',
        escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel, 0), 1) + 1,
        updated_at = NOW()
    WHERE id = ticket_record.id;
    
    -- Log da escalação automática
    PERFORM public.log_sla_action(
      ticket_record.id,
      'SLA vencido - Ticket escalonado automaticamente por processo batch',
      jsonb_build_object(
        'sla_vencido_em', ticket_record.data_limite_sla,
        'escalonamento_nivel', GREATEST(COALESCE(ticket_record.escalonamento_nivel, 0), 1) + 1,
        'status_anterior', ticket_record.status,
        'status_novo', 'escalonado',
        'motivo', 'Processamento automático SLA vencido'
      )
    );
    
    -- Criar notificação de SLA vencido se não existir
    INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
    SELECT ticket_record.id, 'sla_breach', 
           jsonb_build_object(
             'codigo_ticket', ticket_record.codigo_ticket,
             'sla_vencido_em', ticket_record.data_limite_sla,
             'status_antes_escalacao', ticket_record.status,
             'status_depois_escalacao', 'escalonado'
           ), 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications_queue 
      WHERE ticket_id = ticket_record.id AND type = 'sla_breach'
    );
    
    tickets_updated := tickets_updated + 1;
    
    -- Log detalhado para cada ticket processado
    RAISE NOTICE 'Ticket % escalonado: % -> escalonado (SLA vencido em %)', 
      ticket_record.codigo_ticket, ticket_record.status, ticket_record.data_limite_sla;
  END LOOP;
  
  -- Processar também tickets que já estão com status_sla = 'vencido' mas ainda não foram escalonados
  -- (casos onde o trigger anterior não funcionou corretamente)
  FOR ticket_record IN
    SELECT id, codigo_ticket, data_limite_sla, status, status_sla, escalonamento_nivel
    FROM public.tickets
    WHERE status_sla = 'vencido'
      AND status IN ('aberto', 'em_atendimento')  -- Ainda não foram escalonados
  LOOP
    -- Escalar estes tickets também
    UPDATE public.tickets 
    SET status = 'escalonado'::ticket_status,
        escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel, 0), 1) + 1,
        updated_at = NOW()
    WHERE id = ticket_record.id;
    
    -- Log da correção
    PERFORM public.log_sla_action(
      ticket_record.id,
      'Correção: Ticket com SLA vencido foi escalonado',
      jsonb_build_object(
        'sla_vencido_em', ticket_record.data_limite_sla,
        'escalonamento_nivel', GREATEST(COALESCE(ticket_record.escalonamento_nivel, 0), 1) + 1,
        'status_anterior', ticket_record.status,
        'status_novo', 'escalonado',
        'motivo', 'Correção automática - SLA já vencido'
      )
    );
    
    tickets_updated := tickets_updated + 1;
    
    RAISE NOTICE 'Correção: Ticket % escalonado (SLA já vencido): % -> escalonado', 
      ticket_record.codigo_ticket, ticket_record.status;
  END LOOP;
  
  -- Log do processamento total
  IF tickets_updated > 0 THEN
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'tickets_sla_batch',
      'process_overdue_slas_fixed',
      'Processamento automático de SLAs vencidos (corrigido): ' || tickets_updated || ' tickets processados',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('tickets_processados', tickets_updated),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN tickets_updated;
END;
$$;