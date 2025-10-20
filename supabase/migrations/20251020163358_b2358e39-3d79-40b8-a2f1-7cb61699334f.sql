-- ========================================
-- CORREÇÃO: Configurar Service Role Key usando tabela de sistema
-- ========================================

-- Criar tabela para armazenar configurações do sistema (se não existir)
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Drop e recriar policy para evitar conflitos
DROP POLICY IF EXISTS "Service role can read system config" ON public.system_config;
CREATE POLICY "Service role can read system config"
  ON public.system_config
  FOR SELECT
  TO service_role
  USING (true);

-- Criar função auxiliar para buscar o service role key
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_value text;
BEGIN
  -- Buscar a chave da tabela de configuração
  SELECT value INTO key_value
  FROM public.system_config
  WHERE key = 'service_role_key'
  LIMIT 1;
  
  -- Se não encontrar, retornar NULL e logar warning
  IF key_value IS NULL THEN
    RAISE WARNING 'Service role key não encontrada. Execute: INSERT INTO public.system_config (key, value, description) VALUES (''service_role_key'', ''sua-chave-aqui'', ''Service Role Key for HTTP calls'');';
  END IF;
  
  RETURN key_value;
END;
$$;

COMMENT ON FUNCTION public.get_service_role_key() IS 'Busca service role key da tabela system_config para uso em triggers e cron jobs';

-- ========================================
-- ATUALIZAR TRIGGERS E CRON JOBS EXISTENTES
-- ========================================

-- Recriar função process_notifications_trigger
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
          'Authorization', 'Bearer ' || public.get_service_role_key()
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

-- Recriar função process_sla_breach_notification
CREATE OR REPLACE FUNCTION public.process_sla_breach_notification()
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
        'Authorization', 'Bearer ' || public.get_service_role_key()
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

-- Remover cron jobs antigos se existirem
DO $$
BEGIN
  PERFORM cron.unschedule('pause-sla-at-business-close');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('resume-sla-at-business-start');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;

-- Pausa SLA às 18h30 (hora de São Paulo)
SELECT cron.schedule(
  'pause-sla-at-business-close',
  '30 21 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_service_role_key()
    ),
    body := jsonb_build_object('action', 'pause')
  );
  $$
);

-- Retoma SLA às 8h30 (hora de São Paulo)
SELECT cron.schedule(
  'resume-sla-at-business-start',
  '30 11 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/pause-sla-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_service_role_key()
    ),
    body := jsonb_build_object('action', 'resume')
  );
  $$
);