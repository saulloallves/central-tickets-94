-- Criar template para mensagem customizada
INSERT INTO public.message_templates (
  template_key, 
  template_content, 
  description, 
  variables, 
  is_active
) VALUES (
  'mensagem_customizada',
  '💬 *MENSAGEM DA EQUIPE*

📋 *Ticket:* {{codigo_ticket}}

📝 *Mensagem:*
{{mensagem_customizada}}

🕐 *Enviado em:* {{timestamp}}',
  'Template para mensagem customizada enviada ao franqueado',
  '["codigo_ticket", "mensagem_customizada", "timestamp"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE 
SET 
  template_content = EXCLUDED.template_content,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();