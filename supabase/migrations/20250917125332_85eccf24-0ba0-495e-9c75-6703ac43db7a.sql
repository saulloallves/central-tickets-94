-- Fix the process_overdue_slas function to remove invalid 'cancelado' status
CREATE OR REPLACE FUNCTION public.process_overdue_slas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tickets_updated INTEGER := 0;
  ticket_record RECORD;
BEGIN
  -- Buscar tickets com SLA vencido que não foram processados
  FOR ticket_record IN
    SELECT id, codigo_ticket, data_limite_sla, status, status_sla, escalonamento_nivel
    FROM public.tickets
    WHERE data_limite_sla < NOW()
      AND status_sla != 'vencido'
      AND status NOT IN ('concluido')  -- Removed 'cancelado' since it doesn't exist
  LOOP
    -- Atualizar status SLA para vencido (isso vai disparar o trigger)
    UPDATE public.tickets 
    SET status_sla = 'vencido',
        updated_at = NOW()
    WHERE id = ticket_record.id;
    
    -- Criar notificação de SLA vencido se não existir
    INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
    SELECT ticket_record.id, 'sla_breach', 
           jsonb_build_object(
             'codigo_ticket', ticket_record.codigo_ticket,
             'sla_vencido_em', ticket_record.data_limite_sla
           ), 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications_queue 
      WHERE ticket_id = ticket_record.id AND type = 'sla_breach'
    );
    
    tickets_updated := tickets_updated + 1;
  END LOOP;
  
  -- Log do processamento
  IF tickets_updated > 0 THEN
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'tickets_sla_batch',
      'process_overdue_slas',
      'Processamento automático de SLAs vencidos: ' || tickets_updated || ' tickets',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('tickets_processados', tickets_updated),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN tickets_updated;
END;
$function$;