-- Remover TODOS os triggers da tabela tickets
DROP TRIGGER IF EXISTS detect_crise_trigger ON tickets;
DROP TRIGGER IF EXISTS auto_link_crisis_trigger ON tickets;
DROP TRIGGER IF EXISTS trigger_detect_and_group_crise_improved ON tickets;
DROP TRIGGER IF EXISTS tickets_before_insert_trigger ON tickets;
DROP TRIGGER IF EXISTS tickets_after_insert_notify ON tickets;
DROP TRIGGER IF EXISTS tickets_after_update_notify ON tickets;
DROP TRIGGER IF EXISTS auto_process_sla_trigger ON tickets;
DROP TRIGGER IF EXISTS enforce_ticket_transition_trigger ON tickets;
DROP TRIGGER IF EXISTS audit_ticket_changes_trigger ON tickets;
DROP TRIGGER IF EXISTS log_ticket_changes_trigger ON tickets;

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