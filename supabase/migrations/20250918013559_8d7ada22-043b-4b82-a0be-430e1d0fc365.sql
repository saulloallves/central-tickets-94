-- Create function to process SLA and escalate tickets automatically
CREATE OR REPLACE FUNCTION public.auto_process_sla_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if SLA is overdue and status hasn't been updated yet
  IF NEW.data_limite_sla < NOW() AND NEW.status_sla != 'vencido' THEN
    -- Update SLA status to overdue
    NEW.status_sla := 'vencido';
    
    -- Escalate if not already escalated or completed
    IF NEW.status NOT IN ('escalonado', 'concluido') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Create notification for SLA breach
      INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
      VALUES (
        NEW.id, 
        'sla_breach', 
        jsonb_build_object(
          'codigo_ticket', NEW.codigo_ticket,
          'sla_vencido_em', NEW.data_limite_sla,
          'escalonamento_nivel', NEW.escalonamento_nivel
        ), 
        'pending'
      ) ON CONFLICT (ticket_id, type) WHERE type = 'sla_breach' DO NOTHING;
      
      -- Log the action
      PERFORM public.log_sla_action(
        NEW.id,
        'SLA vencido - Ticket escalonado automaticamente via trigger',
        jsonb_build_object(
          'sla_vencido_em', NEW.data_limite_sla,
          'escalonamento_nivel', NEW.escalonamento_nivel,
          'trigger_executado', NOW()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run on every ticket update
DROP TRIGGER IF EXISTS auto_sla_escalation_trigger ON public.tickets;
CREATE TRIGGER auto_sla_escalation_trigger
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_process_sla_on_update();