-- Habilitar extensões necessárias para cron e http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar função simplificada para processar notificações SLA imediatamente
CREATE OR REPLACE FUNCTION public.process_sla_notifications_immediately()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for uma notificação de SLA, chamar edge function imediatamente
  IF NEW.type IN ('sla_breach', 'sla_half') AND NEW.status = 'pending' THEN
    -- Chamar função de processamento via HTTP em background
    PERFORM net.http_post(
      url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA4ODczOSwiZXhwIjoyMDYyNjY0NzM5fQ.oJ8vNFaGdlEHzJPuepSqe88kWdLADKHKcxtaOKtdwg4'
      ),
      body := jsonb_build_object(
        'ticket_id', NEW.ticket_id,
        'type', NEW.type,
        'payload', NEW.payload
      )
    );
    
    -- Log da tentativa de processamento
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'notifications_queue',
      NEW.id::TEXT,
      'Notificação SLA enviada para processamento imediato: ' || NEW.type,
      NULL,
      NULL, NULL, NULL, NULL,
      jsonb_build_object('ticket_id', NEW.ticket_id, 'type', NEW.type),
      'painel_interno'::public.log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para processar notificações SLA imediatamente
DROP TRIGGER IF EXISTS trigger_process_sla_immediately ON public.notifications_queue;
CREATE TRIGGER trigger_process_sla_immediately
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.process_sla_notifications_immediately();

-- Configurar cron job para processar notificações pendentes a cada 2 minutos como backup
SELECT cron.schedule(
  'process-sla-notifications-backup',
  '*/2 * * * *',
  'SELECT net.http_post(
    url := ''https://hryurntaljdisohawpqf.supabase.co/functions/v1/sla-processor'',
    headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA4ODczOSwiZXhwIjoyMDYyNjY0NzM5fQ.oJ8vNFaGdlEHzJPuepSqe88kWdLADKHKcxtaOKtdwg4"}''::jsonb,
    body := ''{"scheduled": true}''::jsonb
  );'
);