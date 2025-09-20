-- Criar novo enum com as prioridades corretas
CREATE TYPE ticket_prioridade_new AS ENUM ('baixo', 'medio', 'alto', 'imediato', 'crise');

-- Atualizar todos os tickets existentes para usar valores válidos do novo enum
UPDATE tickets SET prioridade = CASE 
  WHEN prioridade::text = 'posso_esperar' THEN 'baixo'::ticket_prioridade_new
  WHEN prioridade::text = 'ainda_hoje' THEN 'medio'::ticket_prioridade_new
  WHEN prioridade::text = 'ate_1_hora' THEN 'alto'::ticket_prioridade_new
  WHEN prioridade::text = 'imediato' THEN 'imediato'::ticket_prioridade_new
  WHEN prioridade::text = 'crise' THEN 'crise'::ticket_prioridade_new
  ELSE 'medio'::ticket_prioridade_new
END::text::ticket_prioridade;

-- Alterar a coluna para usar o novo tipo
ALTER TABLE tickets ALTER COLUMN prioridade TYPE ticket_prioridade_new USING prioridade::text::ticket_prioridade_new;

-- Remover o enum antigo e renomear o novo
DROP TYPE ticket_prioridade CASCADE;
ALTER TYPE ticket_prioridade_new RENAME TO ticket_prioridade;

-- Definir valor padrão
ALTER TABLE tickets ALTER COLUMN prioridade SET DEFAULT 'medio'::ticket_prioridade;