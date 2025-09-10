-- Create trigger to automatically create internal notifications for notifications_queue events
CREATE OR REPLACE FUNCTION public.create_internal_notification_from_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
  target_equipe_id UUID;
  ticket_data RECORD;
BEGIN
  -- Get ticket data if ticket_id is present
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.*, e.id as equipe_id, e.nome as equipe_nome
    INTO ticket_data
    FROM tickets t
    LEFT JOIN equipes e ON e.id = t.equipe_responsavel_id
    WHERE t.id = NEW.ticket_id;
  END IF;

  -- Determine notification details based on type
  CASE NEW.type
    WHEN 'ticket_created' THEN
      notification_title := 'Novo ticket criado';
      notification_message := 'Ticket ' || COALESCE(ticket_data.codigo_ticket, 'sem código') || ' foi criado';
      notification_type := 'ticket';
      target_equipe_id := ticket_data.equipe_id;
      
    WHEN 'sla_half' THEN
      notification_title := 'SLA 50% atingido';
      notification_message := 'Ticket ' || COALESCE(ticket_data.codigo_ticket, 'sem código') || ' atingiu 50% do prazo SLA';
      notification_type := 'sla';
      target_equipe_id := ticket_data.equipe_id;
      
    WHEN 'sla_breach' THEN
      notification_title := 'SLA vencido';
      notification_message := 'Ticket ' || COALESCE(ticket_data.codigo_ticket, 'sem código') || ' teve o SLA vencido';
      notification_type := 'alert';
      target_equipe_id := ticket_data.equipe_id;
      
    WHEN 'crisis' THEN
      notification_title := 'Crise detectada';
      notification_message := 'Ticket ' || COALESCE(ticket_data.codigo_ticket, 'sem código') || ' foi marcado como crise';
      notification_type := 'crisis';
      target_equipe_id := ticket_data.equipe_id;
      
    WHEN 'internal_access_request' THEN
      notification_title := 'Nova solicitação de acesso';
      notification_message := 'Nova solicitação de acesso interno aguardando aprovação';
      notification_type := 'info';
      target_equipe_id := NULL; -- Will be sent to admins
      
    ELSE
      -- Skip unknown types
      RETURN NEW;
  END CASE;

  -- Create the internal notification
  INSERT INTO public.internal_notifications (
    title,
    message,
    type,
    equipe_id,
    payload
  ) VALUES (
    notification_title,
    notification_message,
    notification_type,
    target_equipe_id,
    jsonb_build_object(
      'ticket_id', NEW.ticket_id,
      'original_type', NEW.type,
      'alert_level', NEW.alert_level,
      'payload', NEW.payload
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on notifications_queue
DROP TRIGGER IF EXISTS trigger_create_internal_notification ON public.notifications_queue;
CREATE TRIGGER trigger_create_internal_notification
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.create_internal_notification_from_queue();