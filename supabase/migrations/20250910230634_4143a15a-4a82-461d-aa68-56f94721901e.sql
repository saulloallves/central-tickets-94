-- Create crisis AI settings table
CREATE TABLE public.crisis_ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_prompt TEXT NOT NULL DEFAULT 'Você é um analista especializado em detecção de crises de TI. Analise se este ticket indica uma crise ou problema generalizado.',
  user_prompt TEXT NOT NULL DEFAULT 'Analise este ticket: {{DESCRICAO}}

Contexto de problemas existentes: {{EXISTING_PROBLEMS}}

Responda APENAS com um JSON válido:
{
  "is_crisis": boolean,
  "similarity_score": number (0-1),
  "confidence": number (0-1),
  "reasoning": "explicação da decisão",
  "keywords": ["palavra1", "palavra2"],
  "should_group": boolean,
  "existing_crisis_id": "uuid ou null"
}',
  threshold_similares INTEGER NOT NULL DEFAULT 3,
  keywords_base TEXT[] NOT NULL DEFAULT ARRAY['sistema', 'caiu', 'travou', 'lento', 'indisponivel', 'erro', 'falha', 'problema'],
  similarity_threshold NUMERIC NOT NULL DEFAULT 0.7,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crisis_ai_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and diretoria manage crisis_ai_settings" 
ON public.crisis_ai_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Insert default settings
INSERT INTO public.crisis_ai_settings (system_prompt, user_prompt, threshold_similares, keywords_base, similarity_threshold)
VALUES (
  'Você é um analista especializado em detecção de crises de TI. Analise se este ticket indica uma crise ou problema generalizado que afeta múltiplos usuários.',
  'Analise este ticket: {{DESCRICAO}}

Contexto de problemas existentes: {{EXISTING_PROBLEMS}}

Tickets similares recentes: {{SIMILAR_COUNT}}

Responda APENAS com um JSON válido:
{
  "is_crisis": boolean,
  "similarity_score": number (0-1),
  "confidence": number (0-1),
  "reasoning": "explicação detalhada da decisão",
  "keywords": ["palavra1", "palavra2"],
  "should_group": boolean,
  "existing_crisis_id": "uuid ou null",
  "recommended_action": "criar_nova_crise | vincular_existente | monitorar"
}',
  3,
  ARRAY['sistema', 'caiu', 'travou', 'lento', 'indisponivel', 'indisponível', 'erro', 'falha', 'problema', 'fora do ar', 'não funciona', 'nao funciona'],
  0.7
);

-- Add trigger for updated_at
CREATE TRIGGER update_crisis_ai_settings_updated_at
BEFORE UPDATE ON public.crisis_ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();