-- Adicionar novos campos de prompts para configurações da IA
ALTER TABLE public.faq_ai_settings 
ADD COLUMN IF NOT EXISTS prompt_typebot TEXT,
ADD COLUMN IF NOT EXISTS prompt_zapi_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS prompt_ticket_suggestions TEXT;