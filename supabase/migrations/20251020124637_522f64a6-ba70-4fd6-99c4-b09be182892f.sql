-- Criar função trigger para processar notificações SLA breach automaticamente
CREATE OR REPLACE FUNCTION process_sla_breach_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response_id bigint;
BEGIN
  -- Apenas processar notificações do tipo sla_breach que estão pending
  IF NEW.type = 'sla_breach' AND NEW.status = 'pending' THEN
    
    -- Chamar edge function process-notifications via HTTP
    SELECT net.http_post(
      url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id,
        'ticket_id', NEW.ticket_id,
        'type', NEW.type,
        'payload', NEW.payload
      )
    ) INTO v_response_id;
    
    -- Log da invocação
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'notifications_queue',
      NEW.id::TEXT,
      'Trigger automático: invocou process-notifications para SLA breach',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('notification_id', NEW.id, 'response_id', v_response_id),
      'sistema'::log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger AFTER INSERT na notifications_queue
DROP TRIGGER IF EXISTS trigger_process_sla_breach ON notifications_queue;

CREATE TRIGGER trigger_process_sla_breach
  AFTER INSERT ON notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION process_sla_breach_notification();

COMMENT ON FUNCTION process_sla_breach_notification() IS 'Processa automaticamente notificações SLA breach via trigger';
COMMENT ON TRIGGER trigger_process_sla_breach ON notifications_queue IS 'Trigger automático para processar notificações SLA breach imediatamente';