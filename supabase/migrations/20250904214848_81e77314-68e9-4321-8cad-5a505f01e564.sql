-- Hotfix: Melhorias no modelo embedding para text-embedding-3-small
ALTER TABLE documentos ALTER COLUMN embedding TYPE vector(1536);

-- Índice HNSW otimizado para cosine distance
CREATE INDEX IF NOT EXISTS documentos_embedding_hnsw
ON documentos USING hnsw (embedding vector_cosine_ops);

-- Adicionar coluna tsvector para busca full-text em português
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tsv tsvector;
CREATE INDEX IF NOT EXISTS documentos_tsv_idx ON documentos USING gin(tsv);

-- Trigger para manter tsv atualizado
CREATE OR REPLACE FUNCTION documentos_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('portuguese', coalesce(NEW.titulo,'')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.categoria,'')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.conteudo::text,'')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documentos_tsv_update ON documentos;
CREATE TRIGGER documentos_tsv_update
BEFORE INSERT OR UPDATE ON documentos
FOR EACH ROW EXECUTE FUNCTION documentos_tsv_trigger();

-- Função híbrida corrigida (sem varrer tabela inteira + normalização)
CREATE OR REPLACE FUNCTION match_documentos_hibrido(
  query_embedding vector(1536),
  query_text text,
  match_count int,
  alpha float DEFAULT 0.6
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
  SELECT id, (1 - (embedding <=> query_embedding))::float AS sim
  FROM documentos
  WHERE status = 'ativo'
  ORDER BY embedding <=> query_embedding
  LIMIT LEAST(match_count*10, 200)
),
kw AS (
  SELECT id, ts_rank_cd(tsv, websearch_to_tsquery('portuguese', query_text))::float AS r
  FROM documentos
  WHERE tsv @@ websearch_to_tsquery('portuguese', query_text)
    AND status = 'ativo'
  ORDER BY r DESC
  LIMIT LEAST(match_count*10, 200)
),
candidatos AS (
  SELECT id FROM sem
  UNION
  SELECT id FROM kw
),
scores_normalizados AS (
  SELECT c.id,
         COALESCE(sem.sim, 0) AS sim,
         COALESCE(kw.r, 0) / NULLIF(MAX(kw.r) OVER (), 0) AS r_norm
  FROM candidatos c
  LEFT JOIN sem ON c.id = sem.id
  LEFT JOIN kw ON c.id = kw.id
),
fused AS (
  SELECT sn.id, d.titulo, d.conteudo::text as conteudo, d.categoria, d.versao,
         sn.sim AS similaridade,
         COALESCE(sn.r_norm, 0) AS text_rank,
         (alpha * sn.sim + (1-alpha) * COALESCE(sn.r_norm, 0)) AS score
  FROM scores_normalizados sn
  JOIN documentos d ON sn.id = d.id
)
SELECT id, titulo, conteudo, categoria, versao, similaridade, text_rank, score
FROM fused
ORDER BY score DESC
LIMIT match_count;
$$;

-- Atualizar todos os tsv existentes (consolidação)
UPDATE documentos 
SET tsv = setweight(to_tsvector('portuguese', coalesce(titulo,'')), 'A') ||
          setweight(to_tsvector('portuguese', coalesce(categoria,'')), 'B') ||
          setweight(to_tsvector('portuguese', coalesce(conteudo::text,'')), 'C');

-- Analisar tabela para otimizar índices
ANALYZE documentos;