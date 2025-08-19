-- Create messaging providers table for Z-API credentials
CREATE TABLE public.messaging_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL DEFAULT 'zapi',
  is_active BOOLEAN NOT NULL DEFAULT true,
  instance_id TEXT NOT NULL,
  instance_token TEXT NOT NULL,
  client_token TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT 'https://api.z-api.io',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(provider_name, is_active) -- Only one active provider per type
);

-- Enable RLS
ALTER TABLE public.messaging_providers ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins manage messaging_providers" 
ON public.messaging_providers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create message templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL, -- 'ticket_created', 'resposta_ticket', etc.
  scope TEXT NOT NULL DEFAULT 'global', -- 'global', 'unit', etc.
  template_content TEXT NOT NULL,
  description TEXT,
  variables JSONB DEFAULT '[]'::jsonb, -- Available variables for substitution
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(template_key, scope, is_active) -- One active template per key/scope
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins manage message_templates" 
ON public.message_templates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default message templates
INSERT INTO public.message_templates (template_key, template_content, description, variables) VALUES
('ticket_created', '🎫 *NOVO TICKET CRIADO*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}', 'Template para notificação de ticket criado', '["codigo_ticket", "unidade_id", "categoria", "prioridade", "descricao_problema", "data_abertura"]'::jsonb),

('resposta_ticket', '💬 *RESPOSTA DO TICKET*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}

📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}', 'Template para resposta de ticket no grupo', '["codigo_ticket", "unidade_id", "texto_resposta", "timestamp"]'::jsonb),

('resposta_ticket_franqueado', '💬 *RESPOSTA DO SEU TICKET*

📋 *Ticket:* {{codigo_ticket}}
📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}

Para mais detalhes, acesse o sistema.', 'Template para resposta enviada ao franqueado', '["codigo_ticket", "texto_resposta", "timestamp"]'::jsonb),

('sla_half', '⚠️ *ALERTA SLA - 50%*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
⏰ *Prazo limite:* {{data_limite_sla}}

⚡ Atenção necessária!', 'Template para alerta de 50% do SLA', '["codigo_ticket", "unidade_id", "data_limite_sla"]'::jsonb),

('sla_breach', '🚨 *SLA VENCIDO*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
⏰ *Venceu em:* {{data_limite_sla}}

🔥 AÇÃO IMEDIATA NECESSÁRIA!', 'Template para SLA vencido', '["codigo_ticket", "unidade_id", "data_limite_sla"]'::jsonb),

('crisis', '🆘 *CRISE ATIVADA*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
💥 *Motivo:* {{motivo}}

🚨 TODOS OS RECURSOS MOBILIZADOS!', 'Template para ativação de crise', '["codigo_ticket", "unidade_id", "motivo"]'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_messaging_providers_updated_at
BEFORE UPDATE ON public.messaging_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();