-- =====================================================
-- Correção das triggers de notificação de SLA
-- =====================================================
-- PROBLEMA: As triggers estavam marcando as notificações como 'processed' imediatamente,
-- impedindo que o sla-processor as enviasse ao WhatsApp.
-- SOLUÇÃO: Remover o UPDATE que marca como processed - isso será feito pelo process-notifications
-- após o envio bem-sucedido ao WhatsApp.

-- 1. Corrigir trigger de SLA vencido
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
      
      -- ✅ REMOVIDO: Não marcar como processada aqui
      -- O process-notifications fará isso após enviar ao WhatsApp
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Corrigir trigger de SLA 50%
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
      v_notification_title := 'SLA em 50%: ' || COALESCE(v_ticket.titulo, 'Sem título');
      
      -- Criar mensagem com informações relevantes
      v_notification_message := 'O ticket atingiu 50% do SLA' ||
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
      
      -- ✅ REMOVIDO: Não marcar como processada aqui
      -- O process-notifications fará isso após enviar ao WhatsApp
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Criar função para reprocessar notificações travadas
CREATE OR REPLACE FUNCTION public.reprocess_stuck_sla_notifications()
RETURNS TABLE(
  notification_id uuid,
  ticket_id uuid,
  notification_type text,
  previous_status text,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE notifications_queue nq
  SET 
    status = 'pending',
    processed_at = NULL,
    attempts = 0
  WHERE 
    nq.type IN ('sla_breach', 'sla_half')
    AND nq.status = 'processed'
    AND nq.sent_to_whatsapp = false
    AND nq.created_at > now() - interval '24 hours'
  RETURNING 
    nq.id as notification_id,
    nq.ticket_id,
    nq.type as notification_type,
    'processed' as previous_status,
    'pending' as new_status;
END;
$function$;

-- Executar reprocessamento das notificações travadas
SELECT * FROM public.reprocess_stuck_sla_notifications();