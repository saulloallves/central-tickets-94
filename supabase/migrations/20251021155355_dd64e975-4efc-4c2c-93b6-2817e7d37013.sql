-- ========================================
-- CORREÇÃO: Bug de escalonamento SLA
-- Problema: sla_vencido_em fica NULL quando SLA pula de positivo para negativo
-- ========================================

-- 1. Criar constraint UNIQUE em notifications_queue (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_queue_ticket_id_type_key'
  ) THEN
    ALTER TABLE notifications_queue 
    ADD CONSTRAINT notifications_queue_ticket_id_type_key 
    UNIQUE (ticket_id, type);
  END IF;
END $$;

-- 2. Corrigir função decrementar_sla_minutos
DROP FUNCTION IF EXISTS public.decrementar_sla_minutos();

CREATE OR REPLACE FUNCTION public.decrementar_sla_minutos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tickets
  SET 
    sla_minutos_restantes = sla_minutos_restantes - 1,
    status_sla = CASE
      WHEN sla_minutos_restantes - 1 <= 0 THEN 'vencido'
      WHEN sla_minutos_restantes - 1 <= (sla_minutos_totais / 2) THEN 'metade'
      ELSE 'dentro_prazo'
    END,
    sla_vencido_em = CASE
      WHEN sla_minutos_restantes - 1 <= 0 AND sla_vencido_em IS NULL THEN NOW()
      ELSE sla_vencido_em
    END,
    updated_at = NOW()
  WHERE 
    status != 'concluido'
    AND sla_pausado = false
    AND sla_pausado_mensagem = false
    AND sla_pausado_horario = false
    AND sla_minutos_restantes > -1440;
END;
$$;

COMMENT ON FUNCTION public.decrementar_sla_minutos() IS 'Decrementa SLA de tickets ativos (corrigido para <= 0)';

-- 3. Corrigir tickets já afetados pelo bug
UPDATE tickets
SET 
  sla_vencido_em = updated_at,
  status_sla = 'vencido'
WHERE 
  status_sla = 'vencido'
  AND sla_vencido_em IS NULL
  AND sla_minutos_restantes <= 0
  AND status != 'concluido';

-- 4. Reprocessar tickets específicos (1663-0001 e 1760-0001)
INSERT INTO notifications_queue (ticket_id, type, alert_level, payload, status)
SELECT 
  t.id,
  'sla_breach',
  'critical',
  jsonb_build_object(
    'codigo_ticket', t.codigo_ticket,
    'titulo', t.titulo,
    'unidade_id', t.unidade_id,
    'nome_unidade', u.grupo,
    'prioridade', t.prioridade,
    'minutos_atrasado', ABS(t.sla_minutos_restantes),
    'vencido_em', t.sla_vencido_em
  ),
  'pending'
FROM tickets t
LEFT JOIN unidades u ON t.unidade_id = u.id
WHERE t.codigo_ticket IN ('1663-0001', '1760-0001')
  AND t.status != 'concluido'
ON CONFLICT (ticket_id, type) DO NOTHING;

-- 5. Log da correção
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_sla_escalation_bug',
  'Corrigido bug de escalonamento SLA (condição <= 0)',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'changes', ARRAY[
      'notifications_queue: constraint UNIQUE adicionada',
      'decrementar_sla_minutos: condição = 0 alterada para <= 0',
      'tickets afetados corrigidos com sla_vencido_em',
      'notificações criadas para tickets 1663-0001 e 1760-0001'
    ],
    'tickets_corrigidos', (
      SELECT COUNT(*) 
      FROM tickets 
      WHERE status_sla = 'vencido' 
        AND sla_vencido_em IS NOT NULL 
        AND sla_minutos_restantes <= 0
    )
  ),
  'sistema'::log_canal
);