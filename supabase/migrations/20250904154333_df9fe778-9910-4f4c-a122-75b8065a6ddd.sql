-- Criar edge function para processar notificações automaticamente quando inseridas na queue
-- Vamos adicionar um trigger que chama a function process-notifications automaticamente

CREATE OR REPLACE FUNCTION public.process_notifications_trigger() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  response_data jsonb;
  http_response record;
BEGIN
  -- Apenas processar se for novo e status pending
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    
    -- Chamar a edge function process-notifications via HTTP
    SELECT 
      status,
      content::jsonb as content
    INTO http_response
    FROM
      net.http_post(
        url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/process-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'ticketId', NEW.ticket_id,
          'type', NEW.type,
          'notificationId', NEW.id
        )
      );

    -- Log resultado se necessário
    IF http_response.status != 200 THEN
      RAISE WARNING 'Failed to process notification: % - %', http_response.status, http_response.content;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela notifications_queue
DROP TRIGGER IF EXISTS trigger_process_notifications_auto ON public.notifications_queue;
CREATE TRIGGER trigger_process_notifications_auto
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW 
  EXECUTE FUNCTION public.process_notifications_trigger();