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

-- Verificar se ainda há tickets com prioridades antigas
SELECT prioridade, COUNT(*) as count 
FROM public.tickets 
WHERE prioridade IN ('urgente', 'alta', 'hoje_18h', 'padrao_24h')
GROUP BY prioridade;