-- Corrigir função de busca por similaridade com cálculo correto
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
  similaridade float
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
    1 - (documentos.embedding <=> query_embedding) AS similaridade
  FROM documentos
  WHERE 
    documentos.status = 'ativo'
    AND (documentos.valido_ate IS NULL OR documentos.valido_ate > now())
    AND 1 - (documentos.embedding <=> query_embedding) > match_threshold
  ORDER BY similaridade DESC
  LIMIT match_count;
END;
$$;