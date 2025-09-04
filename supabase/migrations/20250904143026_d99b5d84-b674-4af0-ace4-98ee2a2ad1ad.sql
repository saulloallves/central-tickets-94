-- Corrigir função de limpeza e limpar notificações bugadas
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Marcar como processadas notificações antigas (mais de 48 horas)
  UPDATE public.notifications_queue 
  SET status = 'processed', processed_at = now()
  WHERE status = 'pending' 
    AND created_at < now() - interval '48 hours';
    
  -- Deletar notificações muito antigas (mais de 30 dias) para evitar acúmulo
  DELETE FROM public.notifications_queue 
  WHERE created_at < now() - interval '30 days';
    
  -- Log da limpeza (usando canal válido)
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'notifications_queue',
    'cleanup',
    'Limpeza automática de notificações antigas executada',
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object('executado_em', now()),
    'web'::public.log_canal  -- Usando canal válido
  );
END;
$function$;

-- Limpeza forçada manual das notificações antigas
UPDATE public.notifications_queue 
SET status = 'processed', 
    processed_at = now()
WHERE status = 'pending' 
  AND created_at < now() - interval '4 hours';

-- Executar função de limpeza corrigida
SELECT public.cleanup_old_notifications();