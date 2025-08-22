-- Corrigir o sistema de prioridades: remover prioridades antigas e ajustar IA

-- 1. Primeiro atualizar tickets existentes com prioridades antigas para as novas
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

-- 2. Remover valores antigos do enum e manter apenas os novos
ALTER TYPE ticket_prioridade RENAME TO ticket_prioridade_old;

CREATE TYPE ticket_prioridade AS ENUM (
  'imediato',      -- 15 minutos
  'ate_1_hora',    -- 1 hora  
  'ainda_hoje',    -- até 18h do dia
  'posso_esperar', -- 24h úteis
  'crise'          -- 5 minutos (apenas automático)
);

-- 3. Atualizar coluna para usar novo enum
ALTER TABLE tickets ALTER COLUMN prioridade TYPE ticket_prioridade USING prioridade::text::ticket_prioridade;

-- 4. Limpar enum antigo
DROP TYPE ticket_prioridade_old;

-- 5. Atualizar função de análise de IA para não definir "crise" como prioridade inicial
-- A IA deve sugerir apenas: imediato, ate_1_hora, ainda_hoje, posso_esperar
-- "crise" será aplicado automaticamente pelo sistema após detecção