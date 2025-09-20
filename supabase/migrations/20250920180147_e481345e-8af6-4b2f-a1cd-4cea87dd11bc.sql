-- Migração step-by-step para atualizar enum de prioridades

-- 1. Criar novo enum com as prioridades corretas
CREATE TYPE ticket_prioridade_new AS ENUM ('baixo', 'medio', 'alto', 'imediato', 'crise');

-- 2. Adicionar nova coluna temporária
ALTER TABLE tickets ADD COLUMN prioridade_temp ticket_prioridade_new;

-- 3. Migrar dados existentes para a nova coluna
UPDATE tickets SET prioridade_temp = CASE 
  WHEN prioridade::text = 'posso_esperar' THEN 'baixo'::ticket_prioridade_new
  WHEN prioridade::text = 'ainda_hoje' THEN 'medio'::ticket_prioridade_new  
  WHEN prioridade::text = 'ate_1_hora' THEN 'alto'::ticket_prioridade_new
  WHEN prioridade::text = 'imediato' THEN 'imediato'::ticket_prioridade_new
  WHEN prioridade::text = 'crise' THEN 'crise'::ticket_prioridade_new
  ELSE 'medio'::ticket_prioridade_new
END;

-- 4. Remover coluna antiga
ALTER TABLE tickets DROP COLUMN prioridade;

-- 5. Renomear nova coluna
ALTER TABLE tickets RENAME COLUMN prioridade_temp TO prioridade;

-- 6. Remover enum antigo
DROP TYPE ticket_prioridade;

-- 7. Renomear novo enum
ALTER TYPE ticket_prioridade_new RENAME TO ticket_prioridade;

-- 8. Definir valor padrão
ALTER TABLE tickets ALTER COLUMN prioridade SET DEFAULT 'medio'::ticket_prioridade;

-- 9. Adicionar constraint NOT NULL se necessário
ALTER TABLE tickets ALTER COLUMN prioridade SET NOT NULL;