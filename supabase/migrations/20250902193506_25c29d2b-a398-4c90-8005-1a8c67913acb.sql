-- Atualizar a função match_documentos para lidar com documentos de dimensões diferentes
-- temporariamente, vamos recriar os embeddings dos documentos existentes

-- Primeiro, vamos limpar os embeddings antigos
UPDATE documentos SET embedding = NULL;