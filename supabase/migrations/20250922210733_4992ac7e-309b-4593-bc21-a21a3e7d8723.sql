-- Adicionar campo para controlar se deve usar base de conhecimento na formatação
ALTER TABLE public.faq_ai_settings 
ADD COLUMN usar_base_conhecimento_formatacao boolean NOT NULL DEFAULT true;