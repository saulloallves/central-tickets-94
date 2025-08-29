-- 1. Criar os tipos ENUM para controle de status e tipo
CREATE TYPE article_status AS ENUM ('ativo', 'vencido', 'em_revisao', 'arquivado', 'substituido');
CREATE TYPE article_type AS ENUM ('permanente', 'temporario');

-- 2. Criar a tabela principal com a dimensão vetorial correta
CREATE TABLE documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artigo_id UUID NOT NULL,
    titulo TEXT NOT NULL,
    conteudo JSONB,
    versao INT NOT NULL DEFAULT 1,
    parent_id UUID REFERENCES documentos(id),
    tipo article_type NOT NULL DEFAULT 'permanente',
    valido_ate TIMESTAMPTZ,
    tags TEXT[],
    status article_status NOT NULL DEFAULT 'ativo',
    justificativa TEXT NOT NULL,
    criado_por TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    embedding VECTOR(3072) -- DIMENSÃO CORRETA PARA text-embedding-3-large
);

-- 3. Criar índices para otimização de buscas
CREATE INDEX idx_documentos_artigo_id ON documentos(artigo_id);
CREATE INDEX idx_documentos_status ON documentos(status);

-- 4. Criar o índice vetorial HNSW para buscas por similaridade ultra-rápidas
CREATE INDEX idx_documentos_embedding ON documentos USING hnsw (embedding vector_l2_ops);

-- 5. Habilitar RLS
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS para acesso apenas por admins
CREATE POLICY "Only admins can access documentos" 
ON documentos 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));