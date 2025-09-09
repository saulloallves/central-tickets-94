-- Versão melhorada da função híbrida que prioriza contexto semântico
CREATE OR REPLACE FUNCTION match_documentos_hibrido(
  query_embedding vector(1536),
  query_text text,
  match_count int,
  alpha float DEFAULT 0.85
)
RETURNS TABLE (
  id uuid,
  titulo text,
  conteudo text,
  categoria text,
  versao int,
  similaridade float,
  text_rank float,
  score float
)
LANGUAGE sql STABLE AS $$
WITH sem AS (
  SELECT id,
         (1 - (embedding <=> query_embedding))::float AS sim
  FROM documentos
  WHERE status = 'ativo'
    AND embedding <=> query_embedding < 0.7   -- ≈ sim > 0.3 (cosine)
  ORDER BY embedding <=> query_embedding
  LIMIT LEAST(match_count*8, 150)
),
kw AS (
  SELECT id,
         ts_rank_cd(tsv, websearch_to_tsquery('portuguese', query_text))::float AS r
  FROM documentos
  WHERE status = 'ativo'
    AND tsv @@ websearch_to_tsquery('portuguese', query_text)
  ORDER BY r DESC
  LIMIT LEAST(match_count*5, 50)
),
candidatos AS (
  -- Só quem passou no filtro semântico
  SELECT id FROM sem
),
scores AS (
  SELECT c.id,
         s.sim,
         COALESCE(k.r, 0) AS r,
         MAX(COALESCE(k.r,0)) OVER () AS r_max,
         MIN(s.sim) OVER () AS sim_min,
         MAX(s.sim) OVER () AS sim_max
  FROM candidatos c
  JOIN sem s ON s.id = c.id
  LEFT JOIN kw k ON k.id = c.id
),
fused AS (
  SELECT d.id, d.titulo, d.conteudo::text AS conteudo, d.categoria, d.versao,
         s.sim AS similaridade,
         (s.r / NULLIF(s.r_max,0))::float AS text_rank,
         (
           alpha * ((s.sim - s.sim_min) / NULLIF(s.sim_max - s.sim_min,0)) +
           (1-alpha) * (s.r / NULLIF(s.r_max,0)) +
           CASE WHEN s.sim > 0.7 THEN 0.1 ELSE 0 END
         )::float AS score
  FROM scores s
  JOIN documentos d ON d.id = s.id
  WHERE d.status = 'ativo'
)
SELECT id, titulo, conteudo, categoria, versao, similaridade, text_rank, score
FROM fused
ORDER BY score DESC, similaridade DESC
LIMIT match_count;
$$;