-- Função para notificar sobre novos atendimentos
CREATE OR REPLACE FUNCTION public.notify_new_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
  recipient_user_id UUID;
  recipient_count INT := 0;
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- Definir tipo de notificação baseado em emergência
  IF NEW.is_emergencia = true THEN
    notification_type := 'alert';
    notification_title := '🚨 EMERGÊNCIA: ' || NEW.franqueado_nome;
    notification_message := 'Atendimento de EMERGÊNCIA recebido da unidade ' || NEW.unidade_id || 
                           ' - ' || NEW.tipo_atendimento || 
                           CASE WHEN NEW.categoria IS NOT NULL THEN ' (Categoria: ' || NEW.categoria || ')' ELSE '' END;
  ELSE
    notification_type := 'info';
    notification_title := 'Novo Atendimento: ' || NEW.franqueado_nome;
    notification_message := 'Novo atendimento recebido da unidade ' || NEW.unidade_id || 
                           ' - ' || NEW.tipo_atendimento ||
                           CASE WHEN NEW.categoria IS NOT NULL THEN ' (Categoria: ' || NEW.categoria || ')' ELSE '' END;
  END IF;

  -- Criar notificação interna
  INSERT INTO public.internal_notifications (
    title,
    message,
    type,
    payload,
    created_by
  ) VALUES (
    notification_title,
    notification_message,
    notification_type,
    jsonb_build_object(
      'chamado_id', NEW.id,
      'unidade_id', NEW.unidade_id,
      'franqueado_nome', NEW.franqueado_nome,
      'tipo_atendimento', NEW.tipo_atendimento,
      'is_emergencia', NEW.is_emergencia,
      'status', NEW.status,
      'prioridade', NEW.prioridade,
      'categoria', NEW.categoria,
      'telefone', NEW.telefone
    ),
    NULL -- Sistema cria a notificação
  ) RETURNING id INTO notification_id;

  -- Adicionar admins como recipients
  FOR recipient_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::app_role
    AND ur.approved = true
  LOOP
    INSERT INTO public.internal_notification_recipients (
      notification_id,
      user_id,
      is_read
    ) VALUES (
      notification_id,
      recipient_user_id,
      false
    );
    recipient_count := recipient_count + 1;
  END LOOP;

  -- Adicionar atendentes da unidade como recipients
  FOR recipient_user_id IN
    SELECT DISTINCT a.user_id
    FROM public.atendentes a
    INNER JOIN public.atendente_unidades au ON a.id = au.atendente_id
    WHERE au.id = NEW.unidade_id
    AND au.ativo = true
    AND a.ativo = true
    AND a.user_id IS NOT NULL
    AND NOT EXISTS (
      -- Evitar duplicatas se o admin também for atendente
      SELECT 1 
      FROM public.internal_notification_recipients inr
      WHERE inr.notification_id = notification_id
      AND inr.user_id = a.user_id
    )
  LOOP
    INSERT INTO public.internal_notification_recipients (
      notification_id,
      user_id,
      is_read
    ) VALUES (
      notification_id,
      recipient_user_id,
      false
    );
    recipient_count := recipient_count + 1;
  END LOOP;

  -- Log da ação
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'internal_notifications',
    notification_id::TEXT,
    'Notificação de novo atendimento criada',
    NULL, -- Sistema
    NULL, NULL, NULL,
    NULL,
    jsonb_build_object(
      'chamado_id', NEW.id,
      'recipients_count', recipient_count,
      'is_emergencia', NEW.is_emergencia,
      'unidade_id', NEW.unidade_id
    ),
    'painel_interno'::public.log_canal
  );

  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função
DROP TRIGGER IF EXISTS trigger_notify_new_atendimento ON public.chamados;

CREATE TRIGGER trigger_notify_new_atendimento
AFTER INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_atendimento();