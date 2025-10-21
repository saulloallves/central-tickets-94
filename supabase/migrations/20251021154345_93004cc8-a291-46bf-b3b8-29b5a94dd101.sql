-- ========================================
-- CORREÇÃO: process_overdue_slas + Cancelar notificações antigas
-- ========================================

-- 1. Cancelar as 25 notificações pendentes antigas de sla_breach
UPDATE notifications_queue
SET status = 'cancelled'
WHERE 
  type = 'sla_breach'
  AND status = 'pending';

-- 2. Corrigir função process_overdue_slas (u.nome_unidade -> u.grupo)
DROP FUNCTION IF EXISTS public.process_overdue_slas();

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
      u.grupo as nome_unidade,  -- ✅ CORRIGIDO: era u.nome_unidade
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

COMMENT ON FUNCTION public.process_overdue_slas() IS 'Processa tickets com SLA vencido e cria notificações de breach (corrigido u.grupo)';

-- Log da migration
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_process_overdue_slas_and_cancel_old',
  'Corrigida coluna u.grupo e canceladas notificações antigas',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'changes', ARRAY[
      'process_overdue_slas: u.nome_unidade -> u.grupo',
      'notifications_queue: notificações antigas canceladas'
    ]
  ),
  'sistema'::log_canal
);