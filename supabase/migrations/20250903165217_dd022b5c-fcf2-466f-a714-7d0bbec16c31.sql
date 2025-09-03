-- Adicionar coluna similar_terms à tabela crises
ALTER TABLE public.crises 
ADD COLUMN similar_terms TEXT[];

-- Adicionar índice para melhor performance nas consultas de similaridade
CREATE INDEX idx_crises_similar_terms ON public.crises USING GIN(similar_terms);