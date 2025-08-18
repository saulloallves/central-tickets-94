-- Create knowledge articles table for FAQ content
CREATE TABLE public.knowledge_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  categoria text,
  tags text[],
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create FAQ logs table to track all interactions
CREATE TABLE public.faq_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pergunta_usuario text NOT NULL,
  resposta_ia_sugerida text NOT NULL,
  usar_resposta_simples boolean NOT NULL DEFAULT false,
  justificativa_abertura text,
  log_prompt_faq jsonb NOT NULL DEFAULT '{}',
  ticket_id uuid,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create FAQ AI settings table for configuration
CREATE TABLE public.faq_ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo text NOT NULL DEFAULT 'gpt-4o-mini',
  temperatura numeric(3,2) NOT NULL DEFAULT 0.7,
  max_tokens integer NOT NULL DEFAULT 1000,
  top_p numeric(3,2) NOT NULL DEFAULT 1.0,
  frequency_penalty numeric(3,2) NOT NULL DEFAULT 0.0,
  presence_penalty numeric(3,2) NOT NULL DEFAULT 0.0,
  base_conhecimento_prompt text NOT NULL DEFAULT 'Você é um assistente especializado em suporte técnico. Use apenas as informações da base de conhecimento para responder.',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_articles
CREATE POLICY "Admins can manage all knowledge_articles" 
ON public.knowledge_articles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active knowledge_articles" 
ON public.knowledge_articles 
FOR SELECT 
USING (ativo = true AND auth.uid() IS NOT NULL);

-- RLS Policies for faq_logs
CREATE POLICY "Admins can manage all faq_logs" 
ON public.faq_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own faq_logs" 
ON public.faq_logs 
FOR SELECT 
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can create their own faq_logs" 
ON public.faq_logs 
FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

-- RLS Policies for faq_ai_settings
CREATE POLICY "Admins can manage all faq_ai_settings" 
ON public.faq_ai_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active faq_ai_settings" 
ON public.faq_ai_settings 
FOR SELECT 
USING (ativo = true AND auth.uid() IS NOT NULL);

-- Add triggers for updated_at
CREATE TRIGGER update_knowledge_articles_updated_at
  BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_faq_ai_settings_updated_at
  BEFORE UPDATE ON public.faq_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default FAQ AI settings
INSERT INTO public.faq_ai_settings (
  modelo,
  temperatura,
  max_tokens,
  base_conhecimento_prompt
) VALUES (
  'gpt-4o-mini',
  0.7,
  1000,
  'Você é um assistente especializado em suporte técnico. Use apenas as informações da base de conhecimento fornecida para responder às perguntas dos usuários. Se não encontrar informações relevantes na base de conhecimento, informe que não há informações suficientes e sugira que seja aberto um ticket para atendimento personalizado.'
);

-- Insert some sample knowledge articles
INSERT INTO public.knowledge_articles (titulo, conteudo, categoria, tags) VALUES 
(
  'Como resetar senha do sistema',
  'Para resetar sua senha: 1. Acesse a tela de login 2. Clique em "Esqueci minha senha" 3. Digite seu email 4. Verifique sua caixa de entrada 5. Clique no link recebido 6. Defina uma nova senha',
  'sistema',
  ARRAY['senha', 'login', 'reset']
),
(
  'Problemas de conexão com internet',
  'Para resolver problemas de conexão: 1. Verifique se o cabo de rede está conectado 2. Reinicie o modem/roteador 3. Teste com outro dispositivo 4. Entre em contato com seu provedor se o problema persistir',
  'infraestrutura', 
  ARRAY['internet', 'conexão', 'rede']
),
(
  'Como gerar relatórios mensais',
  'Para gerar relatórios: 1. Acesse o menu Relatórios 2. Selecione o período desejado 3. Escolha o tipo de relatório 4. Clique em "Gerar" 5. Aguarde o processamento 6. Faça o download do arquivo',
  'sistema',
  ARRAY['relatórios', 'mensal', 'download']
);