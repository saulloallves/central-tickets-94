-- Criar função para criar notificações internas quando um ticket é encaminhado
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_ticket_forwarded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_equipe_nome text;
  v_member_record record;
  v_notification_id uuid;
BEGIN
  -- Apenas processar notificações do tipo ticket_forwarded
  IF NEW.type != 'ticket_forwarded' THEN
    RETURN NEW;
  END IF;

  -- Buscar dados do ticket
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = NEW.ticket_id;

  IF v_ticket.id IS NULL THEN
    RAISE NOTICE 'Ticket não encontrado: %', NEW.ticket_id;
    RETURN NEW;
  END IF;

  -- Buscar nome da equipe
  SELECT nome INTO v_equipe_nome
  FROM public.equipes
  WHERE id = v_ticket.equipe_responsavel_id;

  -- Criar a notificação interna
  INSERT INTO public.internal_notifications (
    title,
    message,
    type,
    equipe_id,
    payload
  ) VALUES (
    '📥 Ticket Encaminhado',
    format('Ticket %s foi encaminhado para a equipe %s', 
           v_ticket.codigo_ticket, 
           COALESCE(v_equipe_nome, 'Não definida')),
    'ticket_forwarded',
    v_ticket.equipe_responsavel_id,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'codigo_ticket', v_ticket.codigo_ticket,
      'equipe_id', v_ticket.equipe_responsavel_id,
      'prioridade', v_ticket.prioridade,
      'categoria', v_ticket.categoria,
      'titulo', v_ticket.titulo,
      'unidade_id', v_ticket.unidade_id,
      'original_type', 'ticket_forwarded',
      'alert_level', 'normal'
    )
  ) RETURNING id INTO v_notification_id;

  -- Criar registros para cada membro da equipe
  FOR v_member_record IN
    SELECT em.user_id
    FROM public.equipe_members em
    WHERE em.equipe_id = v_ticket.equipe_responsavel_id
      AND em.ativo = true
  LOOP
    INSERT INTO public.internal_notification_recipients (
      notification_id,
      user_id,
      is_read,
      read_at
    ) VALUES (
      v_notification_id,
      v_member_record.user_id,
      false,
      NULL
    );
  END LOOP;

  -- Log da ação
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'internal_notifications',
    v_notification_id::TEXT,
    'Notificação interna criada para ticket encaminhado',
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'codigo_ticket', v_ticket.codigo_ticket,
      'equipe_id', v_ticket.equipe_responsavel_id
    ),
    'web'::public.log_canal
  );

  RETURN NEW;
END;
$function$;

-- Criar trigger para executar a função quando uma notificação ticket_forwarded for criada
DROP TRIGGER IF EXISTS create_internal_notification_on_ticket_forwarded_trigger ON public.notifications_queue;

CREATE TRIGGER create_internal_notification_on_ticket_forwarded_trigger
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW
  WHEN (NEW.type = 'ticket_forwarded')
  EXECUTE FUNCTION public.create_internal_notification_on_ticket_forwarded();