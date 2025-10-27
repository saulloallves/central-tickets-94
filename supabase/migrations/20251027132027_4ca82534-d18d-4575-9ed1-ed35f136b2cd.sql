-- Adicionar coluna codigo_plano na tabela plano_acao
ALTER TABLE plano_acao 
ADD COLUMN codigo_plano TEXT UNIQUE;

-- Criar índice para performance
CREATE INDEX idx_plano_acao_codigo_plano ON plano_acao(codigo_plano);

-- Criar índice composto para buscar o último sequencial por unidade
CREATE INDEX idx_plano_acao_codigo_grupo_created ON plano_acao(codigo_grupo, created_at DESC);