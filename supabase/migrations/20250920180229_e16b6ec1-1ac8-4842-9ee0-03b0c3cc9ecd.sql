-- Migração completa para atualizar enum de prioridades

-- 1. Remover triggers que dependem da coluna prioridade
DROP TRIGGER IF EXISTS detect_crise_trigger ON tickets;
DROP TRIGGER IF EXISTS trigger_detect_and_group_crise_improved ON tickets;
DROP TRIGGER IF EXISTS detect_and_group_crise_trigger ON tickets;

-- 2. Criar novo enum com as prioridades corretas
CREATE TYPE ticket_prioridade_new AS ENUM ('baixo', 'medio', 'alto', 'imediato', 'crise');

-- 3. Adicionar nova coluna temporária
ALTER TABLE tickets ADD COLUMN prioridade_temp ticket_prioridade_new;

-- 4. Migrar dados existentes para a nova coluna
UPDATE tickets SET prioridade_temp = CASE 
  WHEN prioridade::text = 'posso_esperar' THEN 'baixo'::ticket_prioridade_new
  WHEN prioridade::text = 'ainda_hoje' THEN 'medio'::ticket_prioridade_new  
  WHEN prioridade::text = 'ate_1_hora' THEN 'alto'::ticket_prioridade_new
  WHEN prioridade::text = 'imediato' THEN 'imediato'::ticket_prioridade_new
  WHEN prioridade::text = 'crise' THEN 'crise'::ticket_prioridade_new
  ELSE 'medio'::ticket_prioridade_new
END;

-- 5. Remover coluna antiga
ALTER TABLE tickets DROP COLUMN prioridade;

-- 6. Renomear nova coluna
ALTER TABLE tickets RENAME COLUMN prioridade_temp TO prioridade;

-- 7. Remover enum antigo
DROP TYPE ticket_prioridade;

-- 8. Renomear novo enum
ALTER TYPE ticket_prioridade_new RENAME TO ticket_prioridade;

-- 9. Definir valor padrão e NOT NULL
ALTER TABLE tickets ALTER COLUMN prioridade SET DEFAULT 'medio'::ticket_prioridade;
ALTER TABLE tickets ALTER COLUMN prioridade SET NOT NULL;

-- 10. Recriar o trigger principal que detecta crises
CREATE TRIGGER detect_and_group_crise_trigger
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION detect_and_group_crise();