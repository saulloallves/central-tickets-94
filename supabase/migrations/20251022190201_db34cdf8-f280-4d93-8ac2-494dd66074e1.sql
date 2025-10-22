-- Fix AI Classifier Advanced Settings to use 30min for 'imediato'
-- and re-correct any tickets created after the first migration

-- Step 1: Update AI Classifier Advanced Settings
UPDATE ai_classifier_advanced_settings
SET priority_matrix = jsonb_set(
  priority_matrix,
  '{imediato,sla_minutes}',
  '30'
)
WHERE ativo = true
  AND (priority_matrix->'imediato'->>'sla_minutes')::INTEGER != 30;

-- Step 2: Re-correct tickets with incorrect data_limite_sla (created after first migration)
UPDATE tickets
SET 
  data_limite_sla = data_abertura + interval '30 minutes',
  sla_minutos_restantes = CASE 
    WHEN status = 'concluido' THEN sla_minutos_restantes
    ELSE GREATEST(0, EXTRACT(EPOCH FROM (data_abertura + interval '30 minutes' - NOW())) / 60)::INTEGER
  END,
  updated_at = NOW()
WHERE prioridade = 'imediato'
  AND sla_minutos_totais = 30
  AND EXTRACT(EPOCH FROM (data_limite_sla - data_abertura)) / 60 BETWEEN 14 AND 16  -- Only tickets with ~15min
  AND status != 'concluido'
  AND data_abertura >= CURRENT_DATE - interval '7 days';  -- Last 7 days

-- Log the results
DO $$
DECLARE
  settings_count INTEGER;
  tickets_count INTEGER;
BEGIN
  -- Count AI settings updated
  SELECT COUNT(*) INTO settings_count
  FROM ai_classifier_advanced_settings
  WHERE ativo = true
    AND (priority_matrix->'imediato'->>'sla_minutes')::INTEGER = 30;
  
  -- Count tickets updated
  GET DIAGNOSTICS tickets_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Configuração AI Classifier: % configurações ativas com "imediato" = 30min', settings_count;
  RAISE NOTICE '✅ Tickets corrigidos: % tickets "imediato" tiveram data_limite_sla ajustada de 15min para 30min', tickets_count;
END $$;