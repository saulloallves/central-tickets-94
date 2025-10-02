-- Corrigir função notify_new_atendimento com sintaxe correta
DROP FUNCTION IF EXISTS public.notify_new_atendimento() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_new_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id UUID;
BEGIN
  -- Criar notificação interna
  INSERT INTO public.internal_notifications (
    titulo,
    mensagem,
    tipo,
    link,
    metadata
  )
  VALUES (
    'Novo Atendimento - ' || NEW.tipo_atendimento,
    'Novo atendimento criado: ' || COALESCE(NEW.franqueado_nome, 'Sem nome') ||
    CASE 
      WHEN NEW.is_emergencia THEN ' 🚨 EMERGÊNCIA'
      ELSE ''
    END,
    CASE 
      WHEN NEW.is_emergencia THEN 'emergencia'
      ELSE 'info'
    END,
    '/admin/atendimentos',
    jsonb_build_object(
      'chamado_id', NEW.id,
      'unidade_id', NEW.unidade_id,
      'franqueado_nome', NEW.franqueado_nome,
      'tipo_atendimento', NEW.tipo_atendimento,
      'is_emergencia', NEW.is_emergencia,
      'status', NEW.status
    )
  )
  RETURNING id INTO v_notif_id;

  -- Notificar admins
  INSERT INTO public.internal_notification_recipients (notification_id, user_id)
  SELECT v_notif_id, p.id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'admin'
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  -- Notificar atendentes vinculados à unidade
  INSERT INTO public.internal_notification_recipients (notification_id, user_id)
  SELECT DISTINCT v_notif_id, a.user_id
  FROM public.atendentes a
  JOIN public.atendente_unidades au ON au.atendente_id = a.id
  WHERE au.id = NEW.unidade_id
    AND a.ativo = true
    AND au.ativo = true
    AND a.user_id IS NOT NULL
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  -- Notificar atendentes concierge se for tipo concierge
  IF NEW.tipo_atendimento = 'concierge' THEN
    INSERT INTO public.internal_notification_recipients (notification_id, user_id)
    SELECT DISTINCT v_notif_id, a.user_id
    FROM public.atendentes a
    WHERE a.tipo = 'concierge'
      AND a.ativo = true
      AND a.user_id IS NOT NULL
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END IF;

  -- Notificar atendentes dfcom se for tipo dfcom
  IF NEW.tipo_atendimento = 'dfcom' THEN
    INSERT INTO public.internal_notification_recipients (notification_id, user_id)
    SELECT DISTINCT v_notif_id, a.user_id
    FROM public.atendentes a
    WHERE a.tipo = 'dfcom'
      AND a.ativo = true
      AND a.user_id IS NOT NULL
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END IF;

  -- Registrar log do sistema
  PERFORM public.log_system_action(
    'notification_sent'::public.log_action_type,
    'internal_notifications'::text,
    v_notif_id::text,
    jsonb_build_object(
      'notification_id', v_notif_id,
      'chamado_id', NEW.id,
      'tipo_atendimento', NEW.tipo_atendimento,
      'is_emergencia', NEW.is_emergencia
    ),
    'painel_interno'::public.log_canal
  );

  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_notify_new_atendimento ON public.chamados;

CREATE TRIGGER trigger_notify_new_atendimento
AFTER INSERT ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_atendimento();