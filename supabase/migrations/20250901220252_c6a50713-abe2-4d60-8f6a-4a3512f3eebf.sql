-- Corrigir a função match_documentos_semantico para usar tipos corretos
CREATE OR REPLACE FUNCTION match_documentos_semantico(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.1,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo jsonb,
  categoria text,
  versao int,
  status article_status,
  criado_em timestamp with time zone,
  tags text[],
  similarity_score float8,
  semantic_relevance float8,
  final_score float8
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.titulo,
    d.conteudo,
    d.categoria,
    d.versao,
    d.status,
    d.criado_em,
    d.tags,
    CASE 
      WHEN d.embedding IS NOT NULL THEN
        CAST((1 - (d.embedding <=> query_embedding)) AS float8)
      ELSE 0.0
    END AS similarity_score,
    CASE 
      WHEN d.embedding IS NOT NULL THEN
        CAST((1 - (d.embedding <=> query_embedding)) AS float8) * 0.8
      ELSE 0.0
    END AS semantic_relevance,
    CASE 
      WHEN d.embedding IS NOT NULL THEN
        CAST((1 - (d.embedding <=> query_embedding)) AS float8)
      ELSE 0.0
    END AS final_score
  FROM documentos d
  WHERE d.status = 'ativo'
    AND d.embedding IS NOT NULL
    AND (1 - (d.embedding <=> query_embedding)) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;