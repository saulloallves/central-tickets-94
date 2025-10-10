-- Recriar função para usar título do ticket nas notificações de SLA vencido
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_sla_breach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_notification_id uuid;
  v_notification_title text;
  v_notification_message text;
  v_equipe_nome text;
BEGIN
  -- Processar notificações do tipo sla_breach que estão pending
  IF NEW.type = 'sla_breach' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket (usando u.grupo para nome da unidade)
    SELECT t.*, u.grupo as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Buscar nome da equipe se existir
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        SELECT nome INTO v_equipe_nome
        FROM equipes
        WHERE id = v_ticket.equipe_responsavel_id;
      END IF;
      
      -- Criar título usando o título do ticket ao invés do código
      v_notification_title := 'SLA VENCIDO: ' || COALESCE(v_ticket.titulo, 'Sem título');
      
      -- Criar mensagem com informações relevantes
      v_notification_message := 'O SLA do ticket foi ultrapassado' ||
        ' • Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
        ' • Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A') ||
        CASE WHEN v_equipe_nome IS NOT NULL THEN ' • Equipe: ' || v_equipe_nome ELSE '' END;
      
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
        'sla_breach',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'titulo', v_ticket.titulo,
          'equipe_nome', v_equipe_nome
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Notificar equipe responsável ou todos os admins/diretoria
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        -- Notificar membros da equipe
        INSERT INTO internal_notification_recipients (notification_id, user_id)
        SELECT v_notification_id, em.user_id
        FROM equipe_members em
        WHERE em.equipe_id = v_ticket.equipe_responsavel_id AND em.ativo = true
        ON CONFLICT (notification_id, user_id) DO NOTHING;
      ELSE
        -- Notificar admins e diretoria
        INSERT INTO internal_notification_recipients (notification_id, user_id)
        SELECT v_notification_id, ur.user_id
        FROM user_roles ur
        WHERE ur.role IN ('admin', 'diretoria') AND ur.approved = true
        ON CONFLICT (notification_id, user_id) DO NOTHING;
      END IF;
      
      -- Marcar como processada
      UPDATE notifications_queue
      SET status = 'processed', processed_at = now()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recriar função para usar título do ticket nas notificações de SLA 50%
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_sla_half()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_notification_id uuid;
  v_notification_title text;
  v_notification_message text;
  v_equipe_nome text;
BEGIN
  -- Processar notificações do tipo sla_half que estão pending
  IF NEW.type = 'sla_half' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket (usando u.grupo para nome da unidade)
    SELECT t.*, u.grupo as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Buscar nome da equipe se existir
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        SELECT nome INTO v_equipe_nome
        FROM equipes
        WHERE id = v_ticket.equipe_responsavel_id;
      END IF;
      
      -- Criar título usando o título do ticket ao invés do código
      v_notification_title := 'Alerta SLA 50%: ' || COALESCE(v_ticket.titulo, 'Sem título');
      
      -- Criar mensagem com informações relevantes
      v_notification_message := 'O ticket atingiu 50% do prazo de SLA' ||
        ' • Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
        ' • Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A') ||
        CASE WHEN v_equipe_nome IS NOT NULL THEN ' • Equipe: ' || v_equipe_nome ELSE '' END;
      
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
        'sla_half',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'titulo', v_ticket.titulo,
          'equipe_nome', v_equipe_nome
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Notificar equipe responsável ou todos os admins/diretoria
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        -- Notificar membros da equipe
        INSERT INTO internal_notification_recipients (notification_id, user_id)
        SELECT v_notification_id, em.user_id
        FROM equipe_members em
        WHERE em.equipe_id = v_ticket.equipe_responsavel_id AND em.ativo = true
        ON CONFLICT (notification_id, user_id) DO NOTHING;
      ELSE
        -- Notificar admins e diretoria
        INSERT INTO internal_notification_recipients (notification_id, user_id)
        SELECT v_notification_id, ur.user_id
        FROM user_roles ur
        WHERE ur.role IN ('admin', 'diretoria') AND ur.approved = true
        ON CONFLICT (notification_id, user_id) DO NOTHING;
      END IF;
      
      -- Marcar como processada
      UPDATE notifications_queue
      SET status = 'processed', processed_at = now()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;