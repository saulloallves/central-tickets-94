-- Habilitar RLS nas tabelas que estão faltando
-- Essas tabelas têm políticas mas RLS não está habilitado

-- Para a tabela user_flows
ALTER TABLE public.user_flows ENABLE ROW LEVEL SECURITY;

-- Para tabelas auxiliares que podem estar sem RLS
ALTER TABLE public.escalation_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Verificar se RAG DOCUMENTOS precisa de RLS
ALTER TABLE "RAG DOCUMENTOS" ENABLE ROW LEVEL SECURITY;

-- Criar política básica para RAG DOCUMENTOS (somente admins)
CREATE POLICY "Only admins can access RAG documents" 
ON "RAG DOCUMENTOS" 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));