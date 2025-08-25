-- Corrigir constraint de foreign key para permitir ticket_id NULL em notifications_queue
-- e ajustar o trigger para solicitações de acesso interno

-- Primeiro, verificar e ajustar a coluna ticket_id para permitir NULL
ALTER TABLE public.notifications_queue 
ALTER COLUMN ticket_id DROP NOT NULL;

-- Ajustar o trigger para usar NULL em vez de UUID aleatório para solicitações internas
CREATE OR REPLACE FUNCTION public.notify_internal_access_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    NULL, -- Não há ticket associado para solicitações de acesso interno
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
$$;