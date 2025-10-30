-- Add configurable max_tokens fields for chat-rag-v4
ALTER TABLE faq_ai_settings 
ADD COLUMN IF NOT EXISTS max_tokens_rerank INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS max_tokens_resposta INTEGER DEFAULT 1000;

-- Update existing active record with default values
UPDATE faq_ai_settings 
SET 
  max_tokens_rerank = 1000,
  max_tokens_resposta = 1000
WHERE ativo = true AND max_tokens_rerank IS NULL;