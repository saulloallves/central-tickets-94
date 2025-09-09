-- Corrigir a função match_documentos_hibrido para funcionar corretamente
DROP FUNCTION IF EXISTS match_documentos_hibrido(vector(1536), text, int, float);

CREATE OR REPLACE FUNCTION match_documentos_hibrido(
  query_embedding vector(1536),
  query_text text,
  match_count int DEFAULT 5,
  alpha float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo jsonb,
  similarity_score float
)
LANGUAGE sql
STABLE
AS $$
  WITH semantic_search AS (
    SELECT 
      d.id,
      d.titulo,
      d.conteudo,
      1 - (d.embedding <=> query_embedding) as semantic_score
    FROM documentos d
    WHERE d.status = 'ativo' 
      AND d.embedding IS NOT NULL
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT 
      d.id,
      d.titulo,
      d.conteudo,
      ts_rank_cd(d.tsv, plainto_tsquery('portuguese', query_text)) as keyword_score
    FROM documentos d
    WHERE d.status = 'ativo'
      AND d.tsv @@ plainto_tsquery('portuguese', query_text)
    ORDER BY ts_rank_cd(d.tsv, plainto_tsquery('portuguese', query_text)) DESC
    LIMIT match_count * 2
  ),
  combined_results AS (
    SELECT 
      COALESCE(s.id, k.id) as id,
      COALESCE(s.titulo, k.titulo) as titulo,
      COALESCE(s.conteudo, k.conteudo) as conteudo,
      COALESCE(s.semantic_score, 0) * alpha + COALESCE(k.keyword_score, 0) * (1 - alpha) as combined_score
    FROM semantic_search s
    FULL OUTER JOIN keyword_search k ON s.id = k.id
  )
  SELECT 
    id,
    titulo,
    conteudo,
    combined_score as similarity_score
  FROM combined_results
  WHERE combined_score > 0
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;