-- Recriar função para usar título do ticket ao invés do código nas notificações de ticket encaminhado
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_ticket_forwarded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id uuid;
  v_equipe_id uuid;
  v_ticket record;
  v_equipe_nome text;
  v_member record;
  v_notification_title text;
  v_notification_message text;
BEGIN
  -- Processar notificações do tipo ticket_forwarded que estão pending
  IF NEW.type = 'ticket_forwarded' AND NEW.status = 'pending' THEN
    v_equipe_id := (NEW.payload->>'equipe_id')::uuid;
    
    IF v_equipe_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Buscar dados do ticket (usando u.grupo para nome da unidade)
    SELECT t.*, u.grupo as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Buscar nome da equipe
    SELECT nome INTO v_equipe_nome
    FROM equipes
    WHERE id = v_equipe_id;
    
    -- Criar título usando o título do ticket ao invés do código
    v_notification_title := 'Ticket encaminhado: ' || COALESCE(v_ticket.titulo, 'Sem título');
    
    -- Criar mensagem com informações relevantes
    v_notification_message := 'Ticket encaminhado para ' || COALESCE(v_equipe_nome, 'equipe') || 
      ' • Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
      ' • Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
    
    -- Criar notificação interna
    INSERT INTO internal_notifications (
      title,
      message,
      type,
      related_ticket_id,
      payload
    )
    VALUES (
      v_notification_title,
      v_notification_message,
      'ticket_forwarded',
      v_ticket.id,
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'titulo', v_ticket.titulo,
        'equipe_id', v_equipe_id,
        'equipe_nome', v_equipe_nome
      )
    )
    RETURNING id INTO v_notification_id;
    
    -- Notificar membros da equipe
    FOR v_member IN
      SELECT em.user_id
      FROM equipe_members em
      WHERE em.equipe_id = v_equipe_id AND em.ativo = true
    LOOP
      INSERT INTO internal_notification_recipients (notification_id, user_id)
      VALUES (v_notification_id, v_member.user_id)
      ON CONFLICT (notification_id, user_id) DO NOTHING;
    END LOOP;
    
    -- Marcar como processada
    UPDATE notifications_queue
    SET status = 'processed', processed_at = now()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;