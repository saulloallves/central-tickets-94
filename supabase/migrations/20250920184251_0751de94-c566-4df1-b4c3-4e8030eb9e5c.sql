-- Atualizar configurações de SLA na tabela ai_classifier_advanced_settings para usar os valores corretos
UPDATE ai_classifier_advanced_settings 
SET priority_matrix = jsonb_set(
  priority_matrix,
  '{baixo,sla_minutes}',
  '1440'::jsonb
)
WHERE ativo = true;

-- Log da correção
SELECT 
  id,
  priority_matrix->'baixo'->>'sla_minutes' as sla_baixo_minutos,
  priority_matrix->'medio'->>'sla_minutes' as sla_medio_minutos,
  priority_matrix->'alto'->>'sla_minutes' as sla_alto_minutos,
  priority_matrix->'imediato'->>'sla_minutes' as sla_imediato_minutos,
  priority_matrix->'crise'->>'sla_minutes' as sla_crise_minutos
FROM ai_classifier_advanced_settings 
WHERE ativo = true;