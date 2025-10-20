-- ========================================
-- CORREÇÃO 2: Corrigir referência a nome_unidade no SLA processor
-- ========================================

-- Remover função antiga primeiro
DROP FUNCTION IF EXISTS public.process_overdue_slas();

-- Recriar função process_overdue_slas com referência correta à coluna
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
      u.grupo as nome_unidade,  -- ✅ CORREÇÃO: usar u.grupo ao invés de u.nome_unidade
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
    -- Criar notificação de SLA breach
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
    ) RETURNING id INTO v_notification_id;
    
    -- Log da criação da notificação
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
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.process_overdue_slas() IS 'Processa tickets com SLA vencido e cria notificações de breach (usa u.grupo como nome_unidade)';

-- Log da migration
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_column_error',
  'Corrigida referência a nome_unidade no processo de SLA',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object('changes', ARRAY['process_overdue_slas']),
  'sistema'::log_canal
);