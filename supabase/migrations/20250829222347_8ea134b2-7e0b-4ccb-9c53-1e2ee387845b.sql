-- Adicionar campo categoria à tabela documentos
ALTER TABLE documentos ADD COLUMN categoria TEXT;

-- Criar índice para otimizar buscas por categoria
CREATE INDEX idx_documentos_categoria ON documentos(categoria);

-- Atualizar documentos existentes com categoria padrão
UPDATE documentos SET categoria = 'geral' WHERE categoria IS NULL;