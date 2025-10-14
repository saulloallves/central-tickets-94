-- Ativar template de SLA 50% existente no banco de dados
UPDATE public.message_templates
SET 
  is_active = TRUE,
  updated_at = NOW()
WHERE template_key = 'sla_half';

-- Log da ativação
COMMENT ON TABLE public.message_templates IS 
'Templates de mensagens do sistema. Template sla_half ativado em 2025-10-14 para usar configuração do banco ao invés de hardcoded';