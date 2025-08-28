-- Add API provider and knowledge base configuration to faq_ai_settings
ALTER TABLE public.faq_ai_settings 
ADD COLUMN IF NOT EXISTS api_provider text DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS knowledge_mode text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS api_base_url text NULL,
ADD COLUMN IF NOT EXISTS custom_headers jsonb DEFAULT '{}'::jsonb;

-- Update existing records to have openai as default provider
UPDATE public.faq_ai_settings 
SET api_provider = 'openai' 
WHERE api_provider IS NULL;

-- Add constraints for valid values
ALTER TABLE public.faq_ai_settings
ADD CONSTRAINT faq_ai_settings_api_provider_check 
CHECK (api_provider IN ('openai', 'anthropic', 'perplexity', 'lambda')),
ADD CONSTRAINT faq_ai_settings_knowledge_mode_check 
CHECK (knowledge_mode IN ('auto', 'artigos', 'documentos', 'sem_rag'));