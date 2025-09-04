-- Limpar notificações antigas e bugadas
-- Marcar como processadas as notificações antigas (mais de 24 horas)
UPDATE public.notifications_queue 
SET status = 'processed', processed_at = now()
WHERE status = 'pending' 
  AND created_at < now() - interval '24 hours';

-- Criar função para limpeza automática de notificações antigas
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
    
  -- Log da limpeza
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'notifications_queue',
    'cleanup',
    'Limpeza automática de notificações antigas executada',
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object('executado_em', now()),
    'sistema'::public.log_canal
  );
END;
$function$;

-- Criar trigger ou cron job simulado (executar limpeza diariamente)
-- Nota: Como não temos pg_cron, criaremos um trigger que executa a limpeza
-- periodicamente quando houver inserções na tabela

CREATE OR REPLACE FUNCTION public.trigger_cleanup_notifications()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  last_cleanup TIMESTAMP;
BEGIN
  -- Verificar se já foi feita limpeza nas últimas 24 horas
  SELECT MAX(timestamp) INTO last_cleanup
  FROM public.logs_de_sistema
  WHERE entidade_afetada = 'notifications_queue'
    AND acao_realizada = 'Limpeza automática de notificações antigas executada';
    
  -- Se não foi feita limpeza ou foi há mais de 24 horas, executar
  IF last_cleanup IS NULL OR last_cleanup < now() - interval '24 hours' THEN
    PERFORM public.cleanup_old_notifications();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para executar limpeza periodicamente
DROP TRIGGER IF EXISTS auto_cleanup_notifications ON public.notifications_queue;
CREATE TRIGGER auto_cleanup_notifications
  AFTER INSERT ON public.notifications_queue
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_cleanup_notifications();