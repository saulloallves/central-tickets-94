-- Remove duplicate function definitions that are causing overload issues
DROP FUNCTION IF EXISTS public.match_documentos_semantico(query_embedding public.vector, match_threshold double precision, match_count integer);

-- Keep only the comprehensive version
-- This function should already exist with full parameters:
-- public.match_documentos_semantico(query_embedding public.vector, query_text text, match_threshold double precision, match_count integer, require_category_match boolean, categoria_filtro text)

-- Ensure the comprehensive function exists
CREATE OR REPLACE FUNCTION public.match_documentos_semantico(
  query_embedding public.vector,
  query_text text DEFAULT '',
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 10,
  require_category_match boolean DEFAULT false,
  categoria_filtro text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo jsonb,
  categoria text,
  similarity double precision,
  criado_em timestamp with time zone,
  criado_por uuid,
  tags text[],
  ia_modelo text,
  profiles jsonb
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
    (1 - (d.embedding <=> query_embedding)) as similarity,
    d.criado_em,
    d.criado_por,
    d.tags,
    d.ia_modelo,
    to_jsonb(p.*) as profiles
  FROM documentos d
  LEFT JOIN profiles p ON d.criado_por = p.id
  WHERE 
    d.ativo = true
    AND d.embedding IS NOT NULL
    AND (1 - (d.embedding <=> query_embedding)) > match_threshold
    AND (NOT require_category_match OR d.categoria = categoria_filtro)
    AND (query_text = '' OR d.titulo ILIKE '%' || query_text || '%' OR (d.conteudo->>'texto') ILIKE '%' || query_text || '%')
  ORDER BY (1 - (d.embedding <=> query_embedding)) DESC
  LIMIT match_count;
END;
$$;

-- Also ensure the criado_por field accepts the system UUID we're now using
-- No need to change the column type since it's already UUID, just document the system UUID
COMMENT ON COLUMN documentos.criado_por IS 'UUID do usuário que criou o documento. Use 00000000-0000-0000-0000-000000000000 para documentos criados pelo sistema.';