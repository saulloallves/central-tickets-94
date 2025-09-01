-- Corrigir função match_documentos_semantico para compatibilidade com o código JavaScript

CREATE OR REPLACE FUNCTION public.match_documentos_semantico(
  query_embedding vector(1536),
  query_text text DEFAULT '',
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 20,
  require_category_match boolean DEFAULT false,
  categoria_filtro text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo jsonb,
  categoria text,
  versao integer,
  similaridade float,
  relevancia_semantica float,
  score_final float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  WITH similarity_base AS (
    SELECT
      d.id,
      d.titulo,
      d.conteudo,
      d.categoria,
      d.versao,
      1 - (d.embedding <=> query_embedding) AS sim_score,
      -- Calcular relevância semântica baseada no contexto
      CASE 
        WHEN query_text != '' AND d.conteudo IS NOT NULL THEN
          -- Bonus por palavras-chave importantes no contexto
          (CASE WHEN d.conteudo::text ILIKE '%' || SPLIT_PART(query_text, ' ', 1) || '%' THEN 0.15 ELSE 0 END) +
          (CASE WHEN d.conteudo::text ILIKE '%' || SPLIT_PART(query_text, ' ', 2) || '%' THEN 0.10 ELSE 0 END) +
          (CASE WHEN d.conteudo::text ILIKE '%' || SPLIT_PART(query_text, ' ', 3) || '%' THEN 0.05 ELSE 0 END) +
          -- Bonus por categoria relacionada
          (CASE WHEN categoria_filtro IS NOT NULL AND d.categoria = categoria_filtro THEN 0.20 ELSE 0 END) +
          -- Bonus por título relevante
          (CASE WHEN d.titulo ILIKE '%' || SPLIT_PART(query_text, ' ', 1) || '%' THEN 0.10 ELSE 0 END)
        ELSE 0
      END AS context_bonus
    FROM documentos d
    WHERE 
      d.status = 'ativo'
      AND (d.valido_ate IS NULL OR d.valido_ate > now())
      AND (NOT require_category_match OR categoria_filtro IS NULL OR d.categoria = categoria_filtro)
  ),
  scored_results AS (
    SELECT 
      *,
      -- Score final combina similaridade vetorial + relevância contextual
      (sim_score * 0.7) + (context_bonus * 0.3) AS score_final
    FROM similarity_base
    WHERE sim_score > match_threshold
  )
  SELECT
    sr.id,
    sr.titulo,
    sr.conteudo,
    sr.categoria,
    sr.versao,
    sr.sim_score AS similaridade,
    sr.context_bonus AS relevancia_semantica,
    sr.score_final
  FROM scored_results sr
  ORDER BY sr.score_final DESC, sr.sim_score DESC
  LIMIT match_count;
END;
$$;