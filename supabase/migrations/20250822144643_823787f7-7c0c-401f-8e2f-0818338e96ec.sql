-- Corrigir prioridades removendo dependências primeiro

-- 1. Identificar e remover views que dependem da coluna prioridade
DROP VIEW IF EXISTS v_tickets_metrics CASCADE;

-- 2. Remover o default temporariamente
ALTER TABLE tickets ALTER COLUMN prioridade DROP DEFAULT;

-- 3. Atualizar tickets existentes com prioridades antigas para as novas
UPDATE tickets 
SET prioridade = CASE 
  WHEN prioridade = 'urgente' THEN 'imediato'
  WHEN prioridade = 'alta' THEN 'ate_1_hora' 
  WHEN prioridade = 'hoje_18h' THEN 'ainda_hoje'
  WHEN prioridade = 'padrao_24h' THEN 'posso_esperar'
  WHEN prioridade = 'crise' THEN 'imediato' -- Crise vira imediato, será redetectado automaticamente
  ELSE prioridade
END
WHERE prioridade IN ('urgente', 'alta', 'hoje_18h', 'padrao_24h', 'crise');

-- 4. Remover valores antigos do enum e manter apenas os novos
ALTER TYPE ticket_prioridade RENAME TO ticket_prioridade_old;

CREATE TYPE ticket_prioridade AS ENUM (
  'imediato',      -- 15 minutos
  'ate_1_hora',    -- 1 hora  
  'ainda_hoje',    -- até 18h do dia
  'posso_esperar', -- 24h úteis
  'crise'          -- 5 minutos (apenas automático)
);

-- 5. Atualizar coluna para usar novo enum
ALTER TABLE tickets ALTER COLUMN prioridade TYPE ticket_prioridade USING prioridade::text::ticket_prioridade;

-- 6. Reestabelecer o default com novo enum
ALTER TABLE tickets ALTER COLUMN prioridade SET DEFAULT 'posso_esperar'::ticket_prioridade;

-- 7. Limpar enum antigo
DROP TYPE ticket_prioridade_old;