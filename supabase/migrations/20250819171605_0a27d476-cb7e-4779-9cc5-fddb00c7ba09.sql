-- Create new enums for the logging system
CREATE TYPE public.log_tipo AS ENUM (
  'acao_humana',
  'acao_ia', 
  'sistema',
  'erro',
  'escalonamento',
  'seguranca'
);

CREATE TYPE public.log_canal AS ENUM (
  'web',
  'whatsapp', 
  'typebot',
  'painel_interno'
);

-- Extend app_role enum to include juridico and diretoria
ALTER TYPE public.app_role ADD VALUE 'juridico';
ALTER TYPE public.app_role ADD VALUE 'diretoria';

-- Create the main logs table
CREATE TABLE public.logs_de_sistema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_log public.log_tipo NOT NULL,
  entidade_afetada TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  acao_realizada TEXT NOT NULL,
  usuario_responsavel UUID REFERENCES auth.users(id),
  ia_modelo TEXT,
  prompt_entrada TEXT,
  resposta_gerada TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  canal public.log_canal,
  origem_ip TEXT,
  navegador_agente TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on logs table
ALTER TABLE public.logs_de_sistema ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for logs
CREATE POLICY "Admins can view all logs" 
ON public.logs_de_sistema 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Juridico can view all logs" 
ON public.logs_de_sistema 
FOR SELECT 
USING (has_role(auth.uid(), 'juridico'::app_role));

CREATE POLICY "Diretoria can view all logs" 
ON public.logs_de_sistema 
FOR SELECT 
USING (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "System can insert logs" 
ON public.logs_de_sistema 
FOR INSERT 
WITH CHECK (true);

-- Prevent updates and deletes (immutability)
CREATE POLICY "No updates allowed" 
ON public.logs_de_sistema 
FOR UPDATE 
USING (false);

CREATE POLICY "No deletes allowed" 
ON public.logs_de_sistema 
FOR DELETE 
USING (false);

-- Create function to log system actions
CREATE OR REPLACE FUNCTION public.log_system_action(
  p_tipo_log public.log_tipo,
  p_entidade_afetada TEXT,
  p_entidade_id TEXT,
  p_acao_realizada TEXT,
  p_usuario_responsavel UUID DEFAULT NULL,
  p_ia_modelo TEXT DEFAULT NULL,
  p_prompt_entrada TEXT DEFAULT NULL,
  p_resposta_gerada TEXT DEFAULT NULL,
  p_dados_anteriores JSONB DEFAULT NULL,
  p_dados_novos JSONB DEFAULT NULL,
  p_canal public.log_canal DEFAULT 'web'::public.log_canal,
  p_origem_ip TEXT DEFAULT NULL,
  p_navegador_agente TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.logs_de_sistema (
    tipo_log,
    entidade_afetada,
    entidade_id,
    acao_realizada,
    usuario_responsavel,
    ia_modelo,
    prompt_entrada,
    resposta_gerada,
    dados_anteriores,
    dados_novos,
    canal,
    origem_ip,
    navegador_agente
  ) VALUES (
    p_tipo_log,
    p_entidade_afetada,
    p_entidade_id,
    p_acao_realizada,
    p_usuario_responsavel,
    p_ia_modelo,
    p_prompt_entrada,
    p_resposta_gerada,
    p_dados_anteriores,
    p_dados_novos,
    p_canal,
    p_origem_ip,
    p_navegador_agente
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Create trigger function to log ticket changes
CREATE OR REPLACE FUNCTION public.log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_system_action(
      'acao_humana'::public.log_tipo,
      'tickets',
      NEW.id::TEXT,
      'Ticket criado',
      NEW.criado_por,
      NULL,
      NULL,
      NULL,
      NULL,
      to_jsonb(NEW),
      'web'::public.log_canal
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_system_action(
      'acao_humana'::public.log_tipo,
      'tickets',
      NEW.id::TEXT,
      'Ticket atualizado',
      auth.uid(),
      NULL,
      NULL,
      NULL,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'web'::public.log_canal
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to log ticket messages
CREATE OR REPLACE FUNCTION public.log_ticket_message_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_system_action(
      CASE 
        WHEN NEW.direcao = 'entrada' THEN 'acao_humana'::public.log_tipo
        ELSE 'acao_humana'::public.log_tipo
      END,
      'ticket_mensagens',
      NEW.id::TEXT,
      CASE 
        WHEN NEW.direcao = 'entrada' THEN 'Mensagem recebida'
        ELSE 'Resposta enviada'
      END,
      NEW.usuario_id,
      NULL,
      NULL,
      NULL,
      NULL,
      to_jsonb(NEW),
      NEW.canal::TEXT::public.log_canal
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER trigger_log_ticket_changes
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();

CREATE TRIGGER trigger_log_ticket_message_changes
  AFTER INSERT ON public.ticket_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_message_changes();

-- Extend notifications_queue for internal alerts
ALTER TABLE public.notifications_queue ADD COLUMN IF NOT EXISTS alert_level TEXT DEFAULT 'normal';
ALTER TABLE public.notifications_queue ADD COLUMN IF NOT EXISTS alert_category TEXT;

-- Add new notification types for alerts
CREATE OR REPLACE FUNCTION public.create_internal_alert(
  p_ticket_id UUID,
  p_alert_type TEXT,
  p_alert_level TEXT DEFAULT 'normal',
  p_alert_category TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  alert_id UUID;
BEGIN
  INSERT INTO public.notifications_queue (
    ticket_id,
    type,
    alert_level,
    alert_category,
    payload,
    status
  ) VALUES (
    p_ticket_id,
    p_alert_type,
    p_alert_level,
    p_alert_category,
    p_payload,
    'pending'
  ) RETURNING id INTO alert_id;
  
  -- Log the alert creation
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'notifications_queue',
    alert_id::TEXT,
    'Alerta interno criado: ' || p_alert_type,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('alert_type', p_alert_type, 'alert_level', p_alert_level),
    'painel_interno'::public.log_canal
  );
  
  RETURN alert_id;
END;
$function$;

-- Create indexes for performance
CREATE INDEX idx_logs_tipo_timestamp ON public.logs_de_sistema(tipo_log, timestamp DESC);
CREATE INDEX idx_logs_entidade ON public.logs_de_sistema(entidade_afetada, entidade_id);
CREATE INDEX idx_logs_usuario ON public.logs_de_sistema(usuario_responsavel, timestamp DESC);
CREATE INDEX idx_logs_timestamp ON public.logs_de_sistema(timestamp DESC);