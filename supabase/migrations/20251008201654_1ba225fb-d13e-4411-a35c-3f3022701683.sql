-- Correção do sistema de notificações de tickets encaminhados
-- Usar equipe_id do payload em vez do ticket atual

CREATE OR REPLACE FUNCTION public.create_internal_notification_on_ticket_forwarded()
RETURNS TRIGGER AS $$
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
    
    -- Extrair equipe_id do payload (CRÍTICO: usar o payload em vez do ticket atual)
    v_equipe_id := (NEW.payload->>'equipe_id')::uuid;
    
    -- Validação: verificar se equipe_id existe no payload
    IF v_equipe_id IS NULL THEN
      RAISE WARNING 'Notificação % sem equipe_id no payload. Payload: %', NEW.id, NEW.payload;
      RETURN NEW;
    END IF;
    
    -- Buscar dados do ticket
    SELECT t.*, u.nome as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NULL THEN
      RAISE WARNING 'Ticket % não encontrado para notificação %', NEW.ticket_id, NEW.id;
      RETURN NEW;
    END IF;
    
    -- Buscar nome da equipe do payload
    SELECT nome INTO v_equipe_nome
    FROM equipes
    WHERE id = v_equipe_id AND ativo = true;
    
    IF v_equipe_nome IS NULL THEN
      RAISE WARNING 'Equipe % não encontrada ou inativa para notificação %', v_equipe_id, NEW.id;
      RETURN NEW;
    END IF;
    
    -- Criar título e mensagem da notificação
    v_notification_title := 'Ticket Encaminhado: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
    v_notification_message := 'Um ticket foi encaminhado para sua equipe (' || v_equipe_nome || '): ' || 
                              COALESCE(v_ticket.titulo, 'Sem título') || 
                              ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
                              ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
    
    -- Log detalhado
    RAISE NOTICE 'Criando notificação interna para equipe % (nome: %) - ticket %', 
      v_equipe_id, v_equipe_nome, v_ticket.codigo_ticket;
    
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
        'equipe_nome', v_equipe_nome
      )
    )
    RETURNING id INTO v_notification_id;
    
    -- Notificar todos os membros ativos da equipe
    FOR v_member IN
      SELECT DISTINCT em.user_id
      FROM equipe_members em
      WHERE em.equipe_id = v_equipe_id
        AND em.ativo = true
    LOOP
      INSERT INTO internal_notification_recipients (notification_id, user_id)
      VALUES (v_notification_id, v_member.user_id)
      ON CONFLICT (notification_id, user_id) DO NOTHING;
      
      RAISE NOTICE 'Notificação % enviada para membro %', v_notification_id, v_member.user_id;
    END LOOP;
    
    -- CRÍTICO: Marcar notificação como processada
    UPDATE notifications_queue
    SET status = 'processed',
        processed_at = now()
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Notificação % marcada como processada', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para reprocessar notificações pendentes existentes
CREATE OR REPLACE FUNCTION public.reprocess_pending_ticket_forwarded_notifications()
RETURNS TABLE(
  notification_id uuid,
  ticket_id uuid,
  equipe_id uuid,
  members_notified integer,
  status text
) AS $$
DECLARE
  v_notification record;
  v_ticket record;
  v_equipe_id uuid;
  v_equipe_nome text;
  v_notification_id uuid;
  v_members_count integer;
  v_member record;
BEGIN
  -- Processar cada notificação pendente do tipo ticket_forwarded
  FOR v_notification IN
    SELECT * FROM notifications_queue
    WHERE type = 'ticket_forwarded'
      AND status = 'pending'
    ORDER BY created_at
  LOOP
    -- Extrair equipe_id do payload
    v_equipe_id := (v_notification.payload->>'equipe_id')::uuid;
    
    IF v_equipe_id IS NULL THEN
      notification_id := v_notification.id;
      ticket_id := v_notification.ticket_id;
      equipe_id := NULL;
      members_notified := 0;
      status := 'ERRO: equipe_id não encontrado no payload';
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- Buscar dados do ticket
    SELECT t.*, u.nome as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = v_notification.ticket_id;
    
    IF v_ticket.id IS NULL THEN
      notification_id := v_notification.id;
      ticket_id := v_notification.ticket_id;
      equipe_id := v_equipe_id;
      members_notified := 0;
      status := 'ERRO: ticket não encontrado';
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- Buscar nome da equipe
    SELECT nome INTO v_equipe_nome
    FROM equipes
    WHERE id = v_equipe_id AND ativo = true;
    
    IF v_equipe_nome IS NULL THEN
      notification_id := v_notification.id;
      ticket_id := v_notification.ticket_id;
      equipe_id := v_equipe_id;
      members_notified := 0;
      status := 'ERRO: equipe não encontrada ou inativa';
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- Criar notificação interna
    INSERT INTO internal_notifications (
      title,
      message,
      type,
      related_ticket_id,
      payload
    )
    VALUES (
      'Ticket Encaminhado: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código'),
      'Um ticket foi encaminhado para sua equipe (' || v_equipe_nome || '): ' || 
      COALESCE(v_ticket.titulo, 'Sem título') || 
      ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
      ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A'),
      'ticket_forwarded',
      v_ticket.id,
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'equipe_id', v_equipe_id,
        'equipe_nome', v_equipe_nome,
        'reprocessed', true
      )
    )
    RETURNING id INTO v_notification_id;
    
    -- Contar e notificar membros
    v_members_count := 0;
    FOR v_member IN
      SELECT DISTINCT em.user_id
      FROM equipe_members em
      WHERE em.equipe_id = v_equipe_id
        AND em.ativo = true
    LOOP
      INSERT INTO internal_notification_recipients (notification_id, user_id)
      VALUES (v_notification_id, v_member.user_id)
      ON CONFLICT (notification_id, user_id) DO NOTHING;
      
      v_members_count := v_members_count + 1;
    END LOOP;
    
    -- Marcar como processada
    UPDATE notifications_queue
    SET status = 'processed',
        processed_at = now()
    WHERE id = v_notification.id;
    
    -- Retornar resultado
    notification_id := v_notification.id;
    ticket_id := v_notification.ticket_id;
    equipe_id := v_equipe_id;
    members_notified := v_members_count;
    status := 'SUCESSO: ' || v_members_count || ' membros notificados';
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;