-- Expandir a tabela faq_ai_settings para incluir configurações completas de IA
ALTER TABLE public.faq_ai_settings 
ADD COLUMN IF NOT EXISTS modelo_classificacao text DEFAULT 'gpt-5-2025-08-07',
ADD COLUMN IF NOT EXISTS modelo_analise text DEFAULT 'gpt-5-2025-08-07',
ADD COLUMN IF NOT EXISTS modelo_resumo text DEFAULT 'gpt-5-mini-2025-08-07',
ADD COLUMN IF NOT EXISTS prompt_sugestao text DEFAULT 'Você é um assistente especializado em suporte técnico. Ajude o atendente com sugestões baseadas na base de conhecimento.',
ADD COLUMN IF NOT EXISTS prompt_chat text DEFAULT 'Você é um assistente de IA da Cresci & Perdi. Ajude o atendente a resolver o ticket do cliente.',
ADD COLUMN IF NOT EXISTS prompt_classificacao text DEFAULT 'Classifique este ticket nas categorias apropriadas baseado na descrição do problema.',
ADD COLUMN IF NOT EXISTS auto_classificacao boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_prioridade boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_equipe boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS usar_busca_semantica boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS limite_tokens_contexto integer DEFAULT 8000,
ADD COLUMN IF NOT EXISTS timeout_requests integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS temperatura_chat numeric DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS temperatura_sugestao numeric DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS temperatura_classificacao numeric DEFAULT 0.1,
ADD COLUMN IF NOT EXISTS max_tokens_chat integer DEFAULT 800,
ADD COLUMN IF NOT EXISTS max_tokens_sugestao integer DEFAULT 1000,
ADD COLUMN IF NOT EXISTS max_tokens_classificacao integer DEFAULT 500,
ADD COLUMN IF NOT EXISTS usar_historico_conversa boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS profundidade_historico integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS filtrar_por_categoria boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS categorias_preferidas text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS usar_feedback_loop boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS log_detalhado boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS modo_debug boolean DEFAULT false;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_faq_ai_settings_ativo ON public.faq_ai_settings(ativo);
CREATE INDEX IF NOT EXISTS idx_faq_ai_settings_updated_at ON public.faq_ai_settings(updated_at);