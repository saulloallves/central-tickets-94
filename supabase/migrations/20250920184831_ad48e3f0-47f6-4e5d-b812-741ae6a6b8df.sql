-- Atualizar configurações de SLA para 300 minutos para prioridade baixo
UPDATE ai_classifier_advanced_settings 
SET priority_matrix = jsonb_set(priority_matrix, '{baixo,sla_minutes}', '300'::jsonb)
WHERE ativo = true;

-- Verificar se atualizou corretamente
SELECT 
  priority_matrix->'baixo'->>'sla_minutes' as sla_baixo_configurado,
  public.get_sla_minutes_for_priority('baixo'::ticket_prioridade) as sla_baixo_funcao_resultado
FROM ai_classifier_advanced_settings 
WHERE ativo = true;