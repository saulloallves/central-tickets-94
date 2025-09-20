-- Primeiro remover valores padrão que podem conflitar
ALTER TABLE tickets ALTER COLUMN prioridade DROP DEFAULT;

-- Renomear enum atual
ALTER TYPE ticket_prioridade RENAME TO ticket_prioridade_old;

-- Criar novo enum
CREATE TYPE ticket_prioridade AS ENUM ('baixo', 'medio', 'alto', 'imediato', 'crise');

-- Atualizar coluna com mapeamento
ALTER TABLE tickets 
ALTER COLUMN prioridade TYPE ticket_prioridade 
USING CASE 
  WHEN prioridade::text = 'posso_esperar' THEN 'baixo'::ticket_prioridade
  WHEN prioridade::text = 'ainda_hoje' THEN 'medio'::ticket_prioridade  
  WHEN prioridade::text = 'ate_1_hora' THEN 'alto'::ticket_prioridade
  WHEN prioridade::text = 'imediato' THEN 'imediato'::ticket_prioridade
  WHEN prioridade::text = 'crise' THEN 'crise'::ticket_prioridade
  ELSE 'medio'::ticket_prioridade
END;

-- Definir novo valor padrão
ALTER TABLE tickets ALTER COLUMN prioridade SET DEFAULT 'medio'::ticket_prioridade;

-- Remover enum antigo
DROP TYPE ticket_prioridade_old;