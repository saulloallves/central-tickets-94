-- Criar tabela para configurações de origem dos números
CREATE TABLE public.notification_source_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'column', 'fixed', 'dynamic'
  source_table TEXT, -- qual tabela buscar (unidades, franqueados, etc)
  source_column TEXT, -- qual coluna buscar
  fixed_value TEXT, -- valor fixo se source_type = 'fixed'
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_type)
);

-- Configurações padrão baseadas no sistema atual
INSERT INTO public.notification_source_config (notification_type, source_type, source_table, source_column, description) VALUES
('resposta_ticket', 'column', 'unidades', 'id_grupo_branco', 'Resposta para grupos - pega de unidades.id_grupo_branco'),
('resposta_ticket_franqueado', 'column', 'franqueados', 'phone', 'Resposta para franqueado - pega de franqueados.phone baseado no unit_code'),
('ticket_created', 'fixed', NULL, NULL, 'Notificação de novo ticket - sem configuração padrão'),
('crisis', 'fixed', NULL, NULL, 'Notificação de crise - sem configuração padrão'),
('crisis_resolved', 'fixed', NULL, NULL, 'Notificação de crise resolvida - sem configuração padrão'),
('crisis_update', 'fixed', NULL, NULL, 'Atualização de crise - sem configuração padrão'),
('sla_half', 'fixed', NULL, NULL, 'SLA 50% - sem configuração padrão'),
('sla_breach', 'fixed', NULL, NULL, 'SLA vencido - sem configuração padrão');

-- Habilitar RLS
ALTER TABLE public.notification_source_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins manage notification_source_config" 
ON public.notification_source_config 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes view notification_source_config" 
ON public.notification_source_config 
FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'gerente'::app_role));