-- Primeiro, atualizar todos os tickets existentes com prioridades antigas para as novas
UPDATE public.tickets 
SET prioridade = CASE 
  WHEN prioridade = 'urgente' THEN 'imediato'
  WHEN prioridade = 'alta' THEN 'ate_1_hora' 
  WHEN prioridade = 'hoje_18h' THEN 'ainda_hoje'
  WHEN prioridade = 'padrao_24h' THEN 'posso_esperar'
  ELSE prioridade
END
WHERE prioridade IN ('urgente', 'alta', 'hoje_18h', 'padrao_24h');

-- Remover os valores antigos do enum (isso falhará se ainda houver dados com esses valores)
-- Primeiro vamos criar um novo enum apenas com os valores corretos
CREATE TYPE ticket_prioridade_new AS ENUM ('imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar', 'crise');

-- Alterar a coluna para usar o novo tipo
ALTER TABLE public.tickets 
ALTER COLUMN prioridade TYPE ticket_prioridade_new 
USING prioridade::text::ticket_prioridade_new;

-- Remover o tipo antigo
DROP TYPE ticket_prioridade;

-- Renomear o novo tipo para o nome original
ALTER TYPE ticket_prioridade_new RENAME TO ticket_prioridade;