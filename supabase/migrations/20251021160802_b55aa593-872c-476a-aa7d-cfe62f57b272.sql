-- ========================================
-- CORREÇÃO: Recalcular sla_vencido_em para tickets com NULL
-- Problema: Alguns tickets têm sla_vencido_em NULL mesmo após vencerem
-- Solução: Recalcular baseado em data_abertura + sla_minutos_totais + tempo_pausado_total
-- ========================================

-- Recalcular sla_vencido_em para tickets vencidos que têm NULL
UPDATE tickets
SET sla_vencido_em = (
  data_abertura + 
  (
    sla_minutos_totais + 
    EXTRACT(EPOCH FROM COALESCE(tempo_pausado_total, INTERVAL '0'))::numeric / 60
  ) * INTERVAL '1 minute'
)
WHERE 
  status_sla = 'vencido'
  AND sla_vencido_em IS NULL
  AND sla_minutos_restantes <= 0
  AND status != 'concluido';

-- Log da correção
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_sla_vencido_em_timestamps',
  'Recalculado sla_vencido_em para tickets com NULL',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'query', 'UPDATE tickets SET sla_vencido_em = data_abertura + (sla_minutos_totais + pausas)',
    'condicoes', ARRAY[
      'status_sla = vencido',
      'sla_vencido_em IS NULL',
      'sla_minutos_restantes <= 0'
    ],
    'tickets_afetados', (
      SELECT COUNT(*) 
      FROM tickets 
      WHERE status_sla = 'vencido' 
        AND sla_vencido_em IS NOT NULL 
        AND sla_minutos_restantes <= 0
        AND status != 'concluido'
    )
  ),
  'sistema'::log_canal
);