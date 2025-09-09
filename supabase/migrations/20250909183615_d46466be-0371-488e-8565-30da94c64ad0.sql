-- Drop existing function to allow recreation with new signature
DROP FUNCTION IF EXISTS public.match_documentos_hibrido(vector, text, integer, double precision);

-- Create the match_documentos_hibrido function with new signature compatible with Z-API WhatsApp approach
CREATE OR REPLACE FUNCTION public.match_documentos_hibrido(
  query_embedding vector(1536),
  query_text text,
  match_count int DEFAULT 12,
  alpha float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo jsonb,
  similarity_score float,
  keyword_score float,
  hybrid_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.titulo,
    kb.conteudo,
    (1 - (kb.embedding <=> query_embedding)) as similarity_score,
    ts_rank_cd(to_tsvector('portuguese', coalesce(kb.titulo, '') || ' ' || coalesce(kb.conteudo::text, '')), 
               plainto_tsquery('portuguese', query_text)) as keyword_score,
    (alpha * (1 - (kb.embedding <=> query_embedding)) + 
     (1 - alpha) * ts_rank_cd(to_tsvector('portuguese', coalesce(kb.titulo, '') || ' ' || coalesce(kb.conteudo::text, '')), 
                              plainto_tsquery('portuguese', query_text))) as hybrid_score
  FROM knowledge_base kb
  WHERE kb.ativo = true
  ORDER BY hybrid_score DESC
  LIMIT match_count;
END;
$$;

-- Set default model for ticket_ai_interactions
ALTER TABLE public.ticket_ai_interactions 
ALTER COLUMN model SET DEFAULT 'gpt-4.1-2025-04-14';

-- Update existing NULL models
UPDATE public.ticket_ai_interactions 
SET model = 'gpt-4.1-2025-04-14' 
WHERE model IS NULL;