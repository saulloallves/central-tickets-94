-- Corrigir data_limite_sla para todos os tickets inconsistentes
-- Recalcula baseado no sla_minutos_totais configurado

UPDATE tickets
SET data_limite_sla = data_abertura + (sla_minutos_totais || ' minutes')::INTERVAL
WHERE status != 'concluido'
  AND sla_minutos_totais IS NOT NULL
  AND ABS(
    EXTRACT(EPOCH FROM (data_limite_sla - data_abertura))::INTEGER / 60 
    - sla_minutos_totais
  ) > 1;