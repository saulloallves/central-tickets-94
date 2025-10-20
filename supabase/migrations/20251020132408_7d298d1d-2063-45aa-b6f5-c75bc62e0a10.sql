-- ============================================================================
-- CORREÇÃO: Substituir sla_status por ticket_sla_status em todas as funções
-- ============================================================================
-- 
-- PROBLEMA: Código está usando 'sla_status' mas o enum correto é 'ticket_sla_status'
-- Isso causa erro: type "sla_status" does not exist
--
-- SOLUÇÃO: Atualizar todas as funções para usar ticket_sla_status
-- ============================================================================

-- 1. Corrigir função decrementar_sla_minutos
DROP FUNCTION IF EXISTS decrementar_sla_minutos();

CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tickets_atualizados INTEGER := 0;
  tickets_vencidos INTEGER := 0;
BEGIN
  -- Decrementar SLA de tickets ativos (não pausados e não concluídos)
  WITH updated AS (
    UPDATE tickets
    SET 
      sla_minutos_restantes = GREATEST(sla_minutos_restantes - 1, -9999),
      sla_ultima_atualizacao = NOW()
    WHERE 
      status != 'concluido'
      AND sla_pausado = false
      AND sla_pausado_mensagem = false
      AND sla_pausado_horario = false
      AND sla_minutos_restantes IS NOT NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO tickets_atualizados FROM updated;

  -- Marcar tickets vencidos (usando ticket_sla_status ao invés de sla_status)
  WITH vencidos AS (
    UPDATE tickets
    SET 
      status_sla = 'vencido'::ticket_sla_status,
      sla_vencido_em = COALESCE(sla_vencido_em, NOW())
    WHERE 
      sla_minutos_restantes <= 0
      AND status_sla != 'vencido'::ticket_sla_status
      AND status != 'concluido'
    RETURNING id
  )
  SELECT COUNT(*) INTO tickets_vencidos FROM vencidos;

  RETURN jsonb_build_object(
    'tickets_atualizados', tickets_atualizados,
    'tickets_vencidos', tickets_vencidos,
    'timestamp', NOW()
  );
END;
$$;

-- 2. Corrigir função process_overdue_slas (se existir)
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
  -- Buscar tickets vencidos que ainda não foram processados
  FOR ticket_record IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.sla_minutos_restantes,
      t.status_sla,
      u.nome_unidade
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE 
      t.sla_minutos_restantes <= 0
      AND t.status_sla != 'vencido'::ticket_sla_status
      AND t.status != 'concluido'
      AND t.sla_pausado = false
    LIMIT 50
  LOOP
    -- Marcar como vencido
    UPDATE tickets
    SET 
      status_sla = 'vencido'::ticket_sla_status,
      sla_vencido_em = NOW()
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
        'sla_minutos', ticket_record.sla_minutos_restantes
      ),
      NOW()
    )
    ON CONFLICT (ticket_id, type) 
    WHERE status = 'pending'
    DO NOTHING;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$;

-- Log da correção
DO $$
BEGIN
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'database_functions',
    'enum_type_correction',
    'Corrigidas funções para usar ticket_sla_status ao invés de sla_status',
    NULL, NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'functions_updated', ARRAY['decrementar_sla_minutos', 'process_overdue_slas'],
      'old_enum', 'sla_status',
      'new_enum', 'ticket_sla_status',
      'timestamp', NOW()
    ),
    'web'::log_canal
  );
END $$;