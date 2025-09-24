-- Adicionar colunas necessárias para simplificar o sistema de avaliação
ALTER TABLE public.avaliacoes_atendimento 
ADD COLUMN tipo_atendimento text,
ADD COLUMN unidade_nome text,
ADD COLUMN unidade_codigo text,
ADD COLUMN grupo_whatsapp_id text;

-- Comentários explicativos
COMMENT ON COLUMN public.avaliacoes_atendimento.tipo_atendimento IS 'Tipo do atendimento: concierge ou dfcom';
COMMENT ON COLUMN public.avaliacoes_atendimento.unidade_nome IS 'Nome da unidade extraído da tabela unidades';
COMMENT ON COLUMN public.avaliacoes_atendimento.unidade_codigo IS 'Código da unidade';
COMMENT ON COLUMN public.avaliacoes_atendimento.grupo_whatsapp_id IS 'ID do grupo WhatsApp da unidade';