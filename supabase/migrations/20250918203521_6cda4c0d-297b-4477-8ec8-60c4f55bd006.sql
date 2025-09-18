-- Drop all specific versions of the function by signature
DROP FUNCTION IF EXISTS public.match_documentos_semantico(public.vector, double precision, integer);
DROP FUNCTION IF EXISTS public.match_documentos_semantico(public.vector, text, double precision, integer, boolean, text);

-- Create the unified function
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