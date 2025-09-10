-- Update the trigger function to also create recipients
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
  new_notification_id UUID;
  team_member RECORD;
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
  ) RETURNING id INTO new_notification_id;

  -- Create notification recipients
  IF target_equipe_id IS NOT NULL THEN
    -- For team-specific notifications, add all active team members
    FOR team_member IN
      SELECT user_id 
      FROM equipe_members 
      WHERE equipe_id = target_equipe_id 
        AND ativo = true
    LOOP
      INSERT INTO public.internal_notification_recipients (
        notification_id,
        user_id
      ) VALUES (
        new_notification_id,
        team_member.user_id
      ) ON CONFLICT (notification_id, user_id) DO NOTHING;
    END LOOP;
  ELSE
    -- For admin notifications (like access requests), add all admins
    FOR team_member IN
      SELECT ur.user_id
      FROM user_roles ur
      WHERE ur.role = 'admin'::app_role
    LOOP
      INSERT INTO public.internal_notification_recipients (
        notification_id,
        user_id
      ) VALUES (
        new_notification_id,
        team_member.user_id
      ) ON CONFLICT (notification_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;