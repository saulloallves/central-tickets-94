-- Habilitar extensões necessárias para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar função para processar notificações SLA imediatamente
CREATE OR REPLACE FUNCTION public.process_sla_notifications_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_record RECORD;
BEGIN
  -- Se for uma notificação de SLA, processar imediatamente
  IF NEW.type IN ('sla_breach', 'sla_half') AND NEW.status = 'pending' THEN
    -- Buscar configuração de notificação para este tipo
    FOR notification_record IN
      SELECT nr.*, nsc.source_value 
      FROM notification_routes nr
      JOIN notification_source_config nsc ON nsc.id = nr.source_config_id
      WHERE nr.type = NEW.type 
        AND nr.ativo = true
        AND nsc.ativo = true
      ORDER BY nr.prioridade ASC
      LIMIT 1
    LOOP
      -- Chamar função de envio de notificação
      PERFORM net.http_post(
        url := (SELECT value FROM system_settings WHERE key = 'supabase_url') || '/functions/v1/send-ticket-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM system_settings WHERE key = 'supabase_service_key')
        ),
        body := jsonb_build_object(
          'ticket_id', NEW.ticket_id,
          'template_key', NEW.type,
          'force_destination', notification_record.source_value
        )
      );
      
      -- Marcar como processada
      UPDATE public.notifications_queue 
      SET status = 'processed', processed_at = now()
      WHERE id = NEW.id;
      
      EXIT; -- Sair após primeira notificação enviada
    END LOOP;
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

-- Configurar cron job para processar notificações pendentes a cada 5 minutos
SELECT cron.schedule(
  'process-sla-notifications',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://bpmlwqpxpjqrnhtvgdhb.supabase.co/functions/v1/sla-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbWx3cXB4cGpxcm5odHZnZGhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDA4NzQ5MCwiZXhwIjoyMDM5NjYzNDkwfQ.yJ7kWBbhOCkXfKAJApJV2o0qQ4SRBWWFSnk4rqXgCZA"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);

-- Processar notificações pendentes existentes imediatamente
DO $$
DECLARE
  pending_notification RECORD;
BEGIN
  FOR pending_notification IN
    SELECT * FROM notifications_queue 
    WHERE type IN ('sla_breach', 'sla_half') 
      AND status = 'pending'
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at ASC
    LIMIT 5
  LOOP
    -- Tentar processar cada notificação pendente
    PERFORM net.http_post(
      url := 'https://bpmlwqpxpjqrnhtvgdhb.supabase.co/functions/v1/send-ticket-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbWx3cXB4cGpxcm5odHZnZGhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDA4NzQ5MCwiZXhwIjoyMDM5NjYzNDkwfQ.yJ7kWBbhOCkXfKAJApJV2o0qQ4SRBWWFSnk4rqXgCZA"
      ),
      body := jsonb_build_object(
        'ticket_id', pending_notification.ticket_id,
        'template_key', pending_notification.type
      )
    );
    
    -- Marcar como processada
    UPDATE notifications_queue 
    SET status = 'processed', processed_at = now()
    WHERE id = pending_notification.id;
  END LOOP;
END $$;