-- Configurar scheduler automático para SLA monitoring
SELECT cron.schedule(
  'sla-monitor-scheduler',
  '*/2 * * * *', -- Executa a cada 2 minutos
  $$
  SELECT
    net.http_post(
        url:='https://hryurntaljdisohawpqf.supabase.co/functions/v1/notification-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
        body:='{"source": "cron_schedule"}'::jsonb
    ) as request_id;
  $$
);

-- Criar rotas de notificação para SLA se não existirem
INSERT INTO public.notification_routes (type, destination_value, priority, is_active, description)
VALUES 
  ('sla_breach', '5511977256029', 1, true, 'Notificação de SLA vencido para número principal'),
  ('sla_half', '5511977256029', 2, true, 'Notificação de 50% do SLA para número principal')
ON CONFLICT (type, destination_value) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description;

-- Melhorar função de log do sistema SLA
CREATE OR REPLACE FUNCTION public.log_sla_action(
  p_ticket_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.logs_de_sistema (
    tipo_log,
    entidade_afetada,
    entidade_id,
    acao_realizada,
    dados_novos,
    canal
  ) VALUES (
    'sistema'::public.log_tipo,
    'tickets_sla',
    p_ticket_id::TEXT,
    p_action,
    p_details,
    'web'::public.log_canal
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Atualizar trigger de tickets para melhor logging de SLA
CREATE OR REPLACE FUNCTION public.tickets_sla_monitor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o SLA mudou para vencido, escalar automaticamente
  IF NEW.status_sla = 'vencido' AND OLD.status_sla != 'vencido' THEN
    -- Escalar ticket se não estiver já escalonado ou concluído
    IF NEW.status NOT IN ('escalonado', 'concluido') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Log da escalação automática
      PERFORM public.log_sla_action(
        NEW.id,
        'SLA vencido - Ticket escalonado automaticamente',
        jsonb_build_object(
          'sla_vencido_em', NEW.data_limite_sla,
          'escalonamento_nivel', NEW.escalonamento_nivel,
          'status_anterior', OLD.status,
          'status_novo', NEW.status
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_tickets_sla_monitor ON public.tickets;
CREATE TRIGGER trigger_tickets_sla_monitor
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_sla_monitor();

-- Função para verificar status do scheduler
CREATE OR REPLACE FUNCTION public.check_sla_scheduler_status()
RETURNS TABLE(
  job_name TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    jobname::TEXT as job_name,
    schedule::TEXT,
    active,
    last_run,
    next_run
  FROM cron.job 
  WHERE jobname = 'sla-monitor-scheduler';
$$;