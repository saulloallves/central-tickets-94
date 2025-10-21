-- Migração: Corrigir process_overdue_slas para usar view calculada
-- Problema: A função estava usando sla_minutos_restantes (desatualizado) ao invés de sla_minutos_restantes_calculado da view

-- =====================================================
-- 1. DROP E RECRIAR FUNÇÃO process_overdue_slas() 
-- =====================================================
DROP FUNCTION IF EXISTS process_overdue_slas();

CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  processed_count INTEGER := 0;
  ticket_record RECORD;
BEGIN
  -- Buscar tickets vencidos usando a VIEW com SLA calculado em tempo real
  FOR ticket_record IN
    SELECT 
      t.id,
      t.codigo_ticket,
      v.sla_minutos_restantes_calculado,
      v.sla_segundos_restantes,
      v.is_overdue,
      t.status_sla,
      u.nome_unidade
    FROM tickets t
    INNER JOIN tickets_with_realtime_sla v ON t.id = v.id
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE 
      v.is_overdue = true  -- ✅ Usar flag calculada da view
      AND t.status_sla != 'vencido'::ticket_sla_status
      AND t.status != 'concluido'
    LIMIT 50
  LOOP
    -- Marcar como vencido
    UPDATE tickets
    SET 
      status_sla = 'vencido'::ticket_sla_status,
      sla_vencido_em = COALESCE(sla_vencido_em, NOW()),
      sla_minutos_restantes = ticket_record.sla_minutos_restantes_calculado -- ✅ Sincronizar com valor calculado
    WHERE id = ticket_record.id;

    -- Criar notificação de vencimento
    INSERT INTO notifications_queue (
      type,
      ticket_id,
      status,
      payload,
      created_at
    ) VALUES (
      'sla_breach',
      ticket_record.id,
      'pending',
      jsonb_build_object(
        'codigo_ticket', ticket_record.codigo_ticket,
        'unidade', ticket_record.nome_unidade,
        'sla_minutos', ticket_record.sla_minutos_restantes_calculado
      ),
      NOW()
    )
    ON CONFLICT (ticket_id, type) 
    WHERE status = 'pending'
    DO NOTHING;

    processed_count := processed_count + 1;
    
    RAISE NOTICE '✅ Ticket % marcado como vencido (SLA calculado: % min)', 
      ticket_record.codigo_ticket, 
      ticket_record.sla_minutos_restantes_calculado;
  END LOOP;

  RETURN processed_count;
END;
$$;

-- =====================================================
-- 2. SINCRONIZAR DADOS DESATUALIZADOS (one-time fix)
-- =====================================================
UPDATE tickets t
SET sla_minutos_restantes = v.sla_minutos_restantes_calculado
FROM tickets_with_realtime_sla v
WHERE t.id = v.id
  AND t.status != 'concluido'
  AND ABS(t.sla_minutos_restantes - v.sla_minutos_restantes_calculado) > 5;

-- =====================================================
-- 3. LOGGING DA CORREÇÃO
-- =====================================================
SELECT log_system_action(
  'sistema'::log_tipo,
  'database_functions',
  'sla_processing_fix',
  'Corrigido process_overdue_slas para usar view calculada com tempo pausado',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'old_source', 'tickets.sla_minutos_restantes',
    'new_source', 'tickets_with_realtime_sla.sla_minutos_restantes_calculado',
    'uses_is_overdue_flag', true,
    'timestamp', NOW()
  ),
  'web'::log_canal
);