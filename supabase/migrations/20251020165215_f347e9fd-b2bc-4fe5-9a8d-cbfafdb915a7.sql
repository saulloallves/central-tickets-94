-- ========================================
-- CORREÇÃO 3: Prevenir notificações duplicadas e permitir SLA negativo ilimitado
-- ========================================

-- 1. Remover função antiga process_overdue_slas
DROP FUNCTION IF EXISTS public.process_overdue_slas();

-- 2. Recriar função process_overdue_slas com ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.process_overdue_slas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_notification_id uuid;
BEGIN
  -- Buscar tickets com SLA vencido que ainda não têm notificação pendente
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.unidade_id,
      u.grupo as nome_unidade,
      t.prioridade,
      t.sla_minutos_restantes,
      t.sla_vencido_em
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE 
      t.status_sla = 'vencido'
      AND t.status != 'concluido'
      AND NOT EXISTS (
        SELECT 1 FROM notifications_queue nq
        WHERE nq.ticket_id = t.id
        AND nq.type = 'sla_breach'
        AND nq.status IN ('pending', 'processing')
      )
    ORDER BY t.sla_minutos_restantes ASC
    LIMIT 50
  LOOP
    -- Criar notificação de SLA breach com ON CONFLICT DO NOTHING para evitar duplicatas
    INSERT INTO notifications_queue (
      ticket_id,
      type,
      alert_level,
      payload,
      status
    ) VALUES (
      v_ticket.id,
      'sla_breach',
      'critical',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'titulo', v_ticket.titulo,
        'unidade_id', v_ticket.unidade_id,
        'nome_unidade', v_ticket.nome_unidade,
        'prioridade', v_ticket.prioridade,
        'minutos_atrasado', ABS(v_ticket.sla_minutos_restantes),
        'vencido_em', v_ticket.sla_vencido_em
      ),
      'pending'
    )
    ON CONFLICT (ticket_id, type) DO NOTHING
    RETURNING id INTO v_notification_id;
    
    -- Log apenas se notificação foi criada
    IF v_notification_id IS NOT NULL THEN
      PERFORM log_system_action(
        'sistema'::log_tipo,
        'notifications_queue',
        v_notification_id::TEXT,
        'Notificação SLA breach criada automaticamente',
        NULL, NULL, NULL, NULL, NULL,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'minutos_atrasado', ABS(v_ticket.sla_minutos_restantes)
        ),
        'sistema'::log_canal
      );
    END IF;
  END LOOP;
END;
$$;

-- 3. Remover função antiga decrementar_sla_minutos
DROP FUNCTION IF EXISTS public.decrementar_sla_minutos();

-- 4. Recriar função decrementar_sla_minutos SEM LIMITAÇÕES de valores negativos
CREATE OR REPLACE FUNCTION public.decrementar_sla_minutos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrementar SLA de todos os tickets ativos que não estão pausados
  -- ✅ REMOÇÃO DE LIMITAÇÕES: Permite SLA negativo ilimitado
  UPDATE tickets
  SET 
    sla_minutos_restantes = sla_minutos_restantes - 1,
    status_sla = CASE
      WHEN sla_minutos_restantes - 1 <= 0 THEN 'vencido'::sla_status
      WHEN sla_minutos_restantes - 1 <= (sla_minutos_totais / 2) THEN 'meio_prazo'::sla_status
      ELSE 'normal'::sla_status
    END,
    sla_vencido_em = CASE
      WHEN sla_minutos_restantes - 1 = 0 THEN NOW()
      ELSE sla_vencido_em
    END,
    updated_at = NOW()
  WHERE 
    status != 'concluido'
    AND sla_pausado = false
    AND sla_pausado_horario = false
    AND sla_pausado_feedback = false;
    
  RAISE NOTICE 'SLA decrementado em 1 minuto para tickets ativos';
END;
$$;

COMMENT ON FUNCTION public.process_overdue_slas() IS 'Processa tickets com SLA vencido e cria notificações de breach (com ON CONFLICT DO NOTHING para evitar duplicatas)';
COMMENT ON FUNCTION public.decrementar_sla_minutos() IS 'Decrementa SLA de tickets ativos sem limitações de valores negativos';

-- Log da migration
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_sla_duplicates_and_negatives',
  'Corrigidas notificações duplicadas e removida limitação de SLA negativo',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'changes', ARRAY[
      'process_overdue_slas: ON CONFLICT DO NOTHING',
      'decrementar_sla_minutos: permite SLA negativo ilimitado'
    ]
  ),
  'sistema'::log_canal
);