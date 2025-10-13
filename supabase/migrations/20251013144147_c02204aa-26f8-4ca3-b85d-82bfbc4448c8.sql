-- CORREÇÃO CRÍTICA: Corrigir process_overdue_slas para usar calcular_tempo_pausado corretamente
-- E resetar notificações que falharam

-- 1. Corrigir a função process_overdue_slas
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_record RECORD;
  notif_count INTEGER := 0;
  tempo_pausado INTERVAL;
  data_limite_efetiva TIMESTAMPTZ;
BEGIN
  RAISE NOTICE '🕐 process_overdue_slas: Iniciando verificação de SLAs vencidos';
  
  FOR ticket_record IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.data_abertura,
      t.data_limite_sla,
      t.prioridade,
      t.status,
      t.status_sla,
      t.sla_pausado,
      t.unidade_id,
      t.equipe_responsavel_id,
      public.calcular_tempo_pausado(t.id) as tempo_pausado
    FROM tickets t
    WHERE t.status != 'concluido'
      AND t.data_limite_sla IS NOT NULL
      AND t.sla_pausado = FALSE
  LOOP
    -- Calcular data limite efetiva (original + tempo pausado)
    data_limite_efetiva := ticket_record.data_limite_sla + ticket_record.tempo_pausado;
    
    RAISE NOTICE '📊 Ticket %: SLA original %, tempo pausado %, SLA efetivo %, agora %',
      ticket_record.codigo_ticket,
      ticket_record.data_limite_sla,
      ticket_record.tempo_pausado,
      data_limite_efetiva,
      NOW();
    
    -- Só criar notificação se o SLA efetivo já passou E não está pausado
    IF NOW() > data_limite_efetiva AND ticket_record.sla_pausado = FALSE THEN
      RAISE NOTICE '⚠️ SLA VENCIDO para ticket %', ticket_record.codigo_ticket;
      
      -- Atualizar status do ticket
      UPDATE tickets 
      SET status_sla = 'vencido'
      WHERE id = ticket_record.id AND status_sla != 'vencido';
      
      -- Criar/atualizar notificação de SLA vencido
      INSERT INTO notifications_queue (
        ticket_id,
        type,
        payload,
        status,
        sent_to_whatsapp,
        alert_level,
        created_at
      ) VALUES (
        ticket_record.id,
        'sla_breach',
        jsonb_build_object(
          'ticket_id', ticket_record.id,
          'codigo_ticket', ticket_record.codigo_ticket,
          'titulo', ticket_record.titulo,
          'prioridade', ticket_record.prioridade,
          'unidade_id', ticket_record.unidade_id,
          'equipe_id', ticket_record.equipe_responsavel_id,
          'data_limite_original', ticket_record.data_limite_sla,
          'tempo_pausado', ticket_record.tempo_pausado,
          'data_limite_efetiva', data_limite_efetiva
        ),
        'pending',
        FALSE,
        'critical',
        NOW()
      )
      ON CONFLICT (ticket_id, type) 
      WHERE type IN ('sla_breach')
      DO UPDATE SET
        status = 'pending',
        sent_to_whatsapp = FALSE,
        payload = EXCLUDED.payload;
      
      notif_count := notif_count + 1;
      
      -- Log
      PERFORM log_sla_action(
        ticket_record.id,
        'SLA vencido - notificação criada',
        jsonb_build_object(
          'data_limite_efetiva', data_limite_efetiva,
          'tempo_pausado', ticket_record.tempo_pausado
        )
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ process_overdue_slas: % notificações de SLA vencido criadas/atualizadas', notif_count;
  RETURN notif_count;
END;
$$;

-- 2. Resetar notificações antigas que foram marcadas como processed mas não enviadas
UPDATE notifications_queue
SET 
  status = 'pending',
  sent_to_whatsapp = FALSE,
  processed_at = NULL,
  attempts = 0
WHERE type IN ('sla_breach', 'sla_half')
  AND status = 'processed'
  AND sent_to_whatsapp = FALSE
  AND created_at >= NOW() - INTERVAL '24 hours';

-- 3. Log da correção
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema'::log_tipo,
  'notifications_queue',
  'system',
  'Correção aplicada: process_overdue_slas corrigido e notificações resetadas',
  jsonb_build_object('action', 'sla_fix_2025_01_13'),
  'web'::log_canal
);