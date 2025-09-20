-- Tentar uma abordagem diferente - usar uma nova coluna temporária
ALTER TABLE tickets ADD COLUMN prioridade_nova ticket_prioridade_old;

-- Copiar dados com mapeamento
UPDATE tickets SET prioridade_nova = CASE 
  WHEN prioridade::text = 'posso_esperar' THEN 'imediato'::ticket_prioridade_old
  WHEN prioridade::text = 'ainda_hoje' THEN 'imediato'::ticket_prioridade_old
  WHEN prioridade::text = 'ate_1_hora' THEN 'imediato'::ticket_prioridade_old
  WHEN prioridade::text = 'imediato' THEN 'imediato'::ticket_prioridade_old
  WHEN prioridade::text = 'crise' THEN 'crise'::ticket_prioridade_old
  ELSE 'imediato'::ticket_prioridade_old
END;

-- Remover coluna original
ALTER TABLE tickets DROP COLUMN prioridade;

-- Renomear coluna
ALTER TABLE tickets RENAME COLUMN prioridade_nova TO prioridade;

-- Criar novo enum
CREATE TYPE ticket_prioridade_new AS ENUM ('baixo', 'medio', 'alto', 'imediato', 'crise');

-- Atualizar coluna para usar novo enum
ALTER TABLE tickets 
ALTER COLUMN prioridade TYPE ticket_prioridade_new 
USING CASE 
  WHEN prioridade::text = 'imediato' THEN 'medio'::ticket_prioridade_new
  WHEN prioridade::text = 'crise' THEN 'crise'::ticket_prioridade_new
  ELSE 'medio'::ticket_prioridade_new
END;

-- Renomear tipos
DROP TYPE ticket_prioridade_old;
ALTER TYPE ticket_prioridade_new RENAME TO ticket_prioridade;

-- Definir valor padrão
ALTER TABLE tickets ALTER COLUMN prioridade SET DEFAULT 'medio'::ticket_prioridade;