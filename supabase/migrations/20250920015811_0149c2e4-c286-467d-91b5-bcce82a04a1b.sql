-- Adicionar coluna prompt_format_response na tabela faq_ai_settings
ALTER TABLE faq_ai_settings 
ADD COLUMN prompt_format_response TEXT;