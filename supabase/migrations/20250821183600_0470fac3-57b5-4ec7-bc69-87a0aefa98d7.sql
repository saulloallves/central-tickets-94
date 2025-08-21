-- Adicionar colunas necessárias para as memórias da base de conhecimento
ALTER TABLE knowledge_articles 
ADD COLUMN IF NOT EXISTS arquivo_path TEXT,
ADD COLUMN IF NOT EXISTS estilo TEXT CHECK (estilo IN ('diretrizes', 'manual')),
ADD COLUMN IF NOT EXISTS subcategoria TEXT,
ADD COLUMN IF NOT EXISTS classificacao JSONB;