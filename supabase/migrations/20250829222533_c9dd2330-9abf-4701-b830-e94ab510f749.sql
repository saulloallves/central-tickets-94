-- Criar função para busca por similaridade vetorial
CREATE OR REPLACE FUNCTION match_documentos(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo jsonb,
  categoria text,
  versao int,
  similarity float
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  SELECT
    documentos.id,
    documentos.titulo,
    documentos.conteudo,
    documentos.categoria,
    documentos.versao,
    (documentos.embedding <#> query_embedding) * -1 AS similarity
  FROM documentos
  WHERE documentos.embedding <#> query_embedding < -match_threshold
  ORDER BY documentos.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;