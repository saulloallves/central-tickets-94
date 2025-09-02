-- Corrigir função match_documentos para ter tipos compatíveis
CREATE OR REPLACE FUNCTION match_documentos(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo jsonb,
  categoria text,
  versao integer,
  similaridade float8
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.titulo,
    d.conteudo,
    d.categoria,
    d.versao,
    (1 - (d.embedding <=> query_embedding))::float8 as similaridade
  FROM documentos d
  WHERE d.status = 'ativo'
    AND d.embedding IS NOT NULL
    AND (1 - (d.embedding <=> query_embedding)) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;