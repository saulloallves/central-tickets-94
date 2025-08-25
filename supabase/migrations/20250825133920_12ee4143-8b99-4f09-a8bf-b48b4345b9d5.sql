-- Trigger para notificar admins sobre novas solicitações de acesso interno
CREATE OR REPLACE FUNCTION notify_internal_access_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar alerta interno para notificar admins sobre nova solicitação
  INSERT INTO public.notifications_queue (
    ticket_id,
    type,
    alert_level,
    alert_category,
    payload,
    status
  ) VALUES (
    gen_random_uuid(), -- Usamos um UUID temporário já que não é relacionado a ticket
    'internal_access_request',
    'normal',
    'sistema',
    jsonb_build_object(
      'request_id', NEW.id,
      'user_id', NEW.user_id,
      'equipe_id', NEW.equipe_id,
      'desired_role', NEW.desired_role,
      'created_at', NEW.created_at
    ),
    'pending'
  );
  
  -- Log da ação
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'internal_access_requests',
    NEW.id::TEXT,
    'Nova solicitação de acesso interno criada',
    NEW.user_id,
    NULL, NULL, NULL,
    NULL,
    jsonb_build_object('equipe_id', NEW.equipe_id, 'desired_role', NEW.desired_role),
    'web'::public.log_canal
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;