-- Adicionar campos de prompts específicos para as diferentes funcionalidades
ALTER TABLE public.faq_ai_settings
ADD COLUMN IF NOT EXISTS prompt_typebot TEXT,
ADD COLUMN IF NOT EXISTS prompt_zapi_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS prompt_ticket_suggestions TEXT;

-- Comentários para documentar os campos
COMMENT ON COLUMN public.faq_ai_settings.prompt_typebot IS 'Prompt para o agente que gera respostas finais no Typebot webhook';
COMMENT ON COLUMN public.faq_ai_settings.prompt_zapi_whatsapp IS 'Prompt para o agente que gera respostas finais no WhatsApp (Z-API)';
COMMENT ON COLUMN public.faq_ai_settings.prompt_ticket_suggestions IS 'Prompt para o agente que gera sugestões no sistema de tickets';