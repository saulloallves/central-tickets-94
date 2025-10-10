-- Corrigir função de criação de notificação interna para ticket criado
-- Problema: tabela unidades usa coluna "grupo" ao invés de "nome"
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_ticket_created()
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
BEGIN
  -- Apenas processar notificações do tipo ticket_created que estão pending
  IF NEW.type = 'ticket_created' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket (CORRIGIDO: usar u.grupo ao invés de u.nome)
    SELECT t.*, u.grupo as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Título mais limpo e direto
      v_notification_title := 'Ticket criado: ' || COALESCE(v_ticket.titulo, 'Sem título');
      
      -- Mensagem: Unidade, horário e prioridade
      v_notification_message := 'Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') || 
                                ' • Aberto ' || to_char(v_ticket.data_abertura, 'HH24:MI') ||
                                ' • Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
      
      -- Criar notificação interna com type 'ticket'
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
        'ticket',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'unidade_id', v_ticket.unidade_id,
          'prioridade', v_ticket.prioridade,
          'data_abertura', v_ticket.data_abertura
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Notificar admins e diretoria
      INSERT INTO internal_notification_recipients (notification_id, user_id)
      SELECT v_notification_id, ur.user_id
      FROM user_roles ur
      WHERE ur.role IN ('admin', 'diretoria')
        AND ur.approved = true
      ON CONFLICT (notification_id, user_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;