-- Corrigir o escalonamento automático para tickets com SLA vencido
-- Garantir que tickets em 'aberto' e 'em_atendimento' sejam escalonados quando o SLA vence

CREATE OR REPLACE FUNCTION public.tickets_sla_monitor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o SLA mudou para vencido, escalar automaticamente
  IF NEW.status_sla = 'vencido' AND OLD.status_sla != 'vencido' THEN
    -- Escalar ticket se estiver aberto ou em atendimento (não escalar se já escalonado ou concluído)
    IF NEW.status IN ('aberto', 'em_atendimento') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Log da escalação automática
      PERFORM public.log_sla_action(
        NEW.id,
        'SLA vencido - Ticket escalonado automaticamente de ' || OLD.status || ' para escalonado',
        jsonb_build_object(
          'sla_vencido_em', NEW.data_limite_sla,
          'escalonamento_nivel', NEW.escalonamento_nivel,
          'status_anterior', OLD.status,
          'status_novo', NEW.status,
          'motivo', 'SLA vencido automaticamente'
        )
      );
      
      -- Log detalhado para debug
      RAISE NOTICE 'Ticket % escalonado automaticamente: % -> %, SLA vencido em %', 
        NEW.codigo_ticket, OLD.status, NEW.status, NEW.data_limite_sla;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS trigger_tickets_sla_monitor ON public.tickets;
CREATE TRIGGER trigger_tickets_sla_monitor
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_sla_monitor();

-- Melhorar a função process_overdue_slas para garantir que processa todos os tickets vencidos
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
  -- Buscar tickets com SLA vencido que não foram processados
  -- Incluir explicitamente tickets 'aberto' e 'em_atendimento'
  FOR ticket_record IN
    SELECT id, codigo_ticket, data_limite_sla, status, status_sla, escalonamento_nivel
    FROM public.tickets
    WHERE data_limite_sla < NOW()
      AND status_sla != 'vencido'
      AND status IN ('aberto', 'em_atendimento', 'escalonado')  -- Incluir todos os status que podem ser processados
  LOOP
    -- Atualizar status SLA para vencido (isso vai disparar o trigger de escalonamento)
    UPDATE public.tickets 
    SET status_sla = 'vencido',
        updated_at = NOW()
    WHERE id = ticket_record.id;
    
    -- Criar notificação de SLA vencido se não existir
    INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
    SELECT ticket_record.id, 'sla_breach', 
           jsonb_build_object(
             'codigo_ticket', ticket_record.codigo_ticket,
             'sla_vencido_em', ticket_record.data_limite_sla,
             'status_antes_escalacao', ticket_record.status
           ), 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications_queue 
      WHERE ticket_id = ticket_record.id AND type = 'sla_breach'
    );
    
    tickets_updated := tickets_updated + 1;
    
    -- Log detalhado para cada ticket processado
    RAISE NOTICE 'Processado ticket %: SLA vencido em %, status: %', 
      ticket_record.codigo_ticket, ticket_record.data_limite_sla, ticket_record.status;
  END LOOP;
  
  -- Log do processamento
  IF tickets_updated > 0 THEN
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'tickets_sla_batch',
      'process_overdue_slas',
      'Processamento automático de SLAs vencidos: ' || tickets_updated || ' tickets processados',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('tickets_processados', tickets_updated),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN tickets_updated;
END;
$$;