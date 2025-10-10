-- Corrigir funções de notificação de ticket encaminhado
-- Problema: ainda referenciam u.nome ao invés de u.grupo

-- Função 1: create_internal_notification_on_ticket_forwarded
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_ticket_forwarded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_notification_id uuid;
  v_notification_title text;
  v_notification_message text;
  v_equipe_id uuid;
  v_equipe_nome text;
  v_member record;
BEGIN
  -- Apenas processar notificações do tipo ticket_forwarded que estão pending
  IF NEW.type = 'ticket_forwarded' AND NEW.status = 'pending' THEN
    
    -- Extrair equipe_id do payload
    v_equipe_id := (NEW.payload->>'equipe_id')::uuid;
    
    IF v_equipe_id IS NULL THEN
      RAISE WARNING 'Notificação % sem equipe_id no payload. Payload: %', NEW.id, NEW.payload;
      RETURN NEW;
    END IF;
    
    -- Buscar dados do ticket (CORRIGIDO: usar u.grupo ao invés de u.nome)
    SELECT t.*, u.grupo as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = NEW.ticket_id;
    
    -- Buscar nome da equipe
    SELECT nome INTO v_equipe_nome
    FROM equipes
    WHERE id = v_equipe_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Criar título e mensagem da notificação
      v_notification_title := 'Ticket encaminhado: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
      v_notification_message := 'Ticket encaminhado para ' || COALESCE(v_equipe_nome, 'equipe') || 
                                ' - ' || COALESCE(v_ticket.titulo, 'Sem título') ||
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
          'equipe_id', v_equipe_id,
          'equipe_nome', v_equipe_nome,
          'unidade_id', v_ticket.unidade_id,
          'prioridade', v_ticket.prioridade
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Notificar todos os membros ativos da equipe
      FOR v_member IN
        SELECT em.user_id
        FROM equipe_members em
        WHERE em.equipe_id = v_equipe_id
          AND em.ativo = true
      LOOP
        INSERT INTO internal_notification_recipients (notification_id, user_id)
        VALUES (v_notification_id, v_member.user_id)
        ON CONFLICT (notification_id, user_id) DO NOTHING;
      END LOOP;
      
      -- Marcar notificação da fila como processada
      UPDATE notifications_queue
      SET status = 'processed', processed_at = now()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Função 2: Remover versão antiga e recriar
DROP FUNCTION IF EXISTS public.reprocess_pending_ticket_forwarded_notifications();

CREATE FUNCTION public.reprocess_pending_ticket_forwarded_notifications()
RETURNS TABLE(
  processed_count integer,
  failed_count integer,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification record;
  v_ticket record;
  v_notification_id uuid;
  v_equipe_id uuid;
  v_equipe_nome text;
  v_member record;
  v_processed integer := 0;
  v_failed integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  -- Buscar todas as notificações pendentes de ticket_forwarded
  FOR v_notification IN
    SELECT * FROM notifications_queue
    WHERE type = 'ticket_forwarded' AND status = 'pending'
    ORDER BY created_at ASC
  LOOP
    BEGIN
      v_equipe_id := (v_notification.payload->>'equipe_id')::uuid;
      
      IF v_equipe_id IS NULL THEN
        v_failed := v_failed + 1;
        v_details := v_details || jsonb_build_object(
          'notification_id', v_notification.id,
          'error', 'equipe_id ausente no payload'
        );
        CONTINUE;
      END IF;
      
      -- Buscar dados do ticket (CORRIGIDO: usar u.grupo ao invés de u.nome)
      SELECT t.*, u.grupo as unidade_nome
      INTO v_ticket
      FROM tickets t
      LEFT JOIN unidades u ON t.unidade_id = u.id
      WHERE t.id = v_notification.ticket_id;
      
      IF v_ticket.id IS NULL THEN
        v_failed := v_failed + 1;
        v_details := v_details || jsonb_build_object(
          'notification_id', v_notification.id,
          'error', 'ticket não encontrado'
        );
        CONTINUE;
      END IF;
      
      -- Buscar nome da equipe
      SELECT nome INTO v_equipe_nome
      FROM equipes
      WHERE id = v_equipe_id;
      
      -- Criar notificação interna
      INSERT INTO internal_notifications (
        title,
        message,
        type,
        related_ticket_id,
        payload
      )
      VALUES (
        'Ticket encaminhado: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código'),
        'Ticket encaminhado para ' || COALESCE(v_equipe_nome, 'equipe') || 
        ' - ' || COALESCE(v_ticket.titulo, 'Sem título') ||
        ' • Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
        ' • Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A'),
        'ticket_forwarded',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'equipe_id', v_equipe_id,
          'equipe_nome', v_equipe_nome
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Adicionar destinatários (membros da equipe)
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
      WHERE id = v_notification.id;
      
      v_processed := v_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_details := v_details || jsonb_build_object(
        'notification_id', v_notification.id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_failed, v_details;
END;
$function$;