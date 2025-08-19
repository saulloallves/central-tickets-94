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

-- Create indexes for performance
CREATE INDEX idx_logs_tipo_timestamp ON public.logs_de_sistema(tipo_log, timestamp DESC);
CREATE INDEX idx_logs_entidade ON public.logs_de_sistema(entidade_afetada, entidade_id);
CREATE INDEX idx_logs_usuario ON public.logs_de_sistema(usuario_responsavel, timestamp DESC);
CREATE INDEX idx_logs_timestamp ON public.logs_de_sistema(timestamp DESC);