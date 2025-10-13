-- ========================================
-- CORREÇÃO: Notificações SLA não chegando no WhatsApp
-- ========================================

-- 1. Adicionar coluna para rastrear envio efetivo ao WhatsApp
ALTER TABLE public.notifications_queue 
ADD COLUMN IF NOT EXISTS sent_to_whatsapp BOOLEAN DEFAULT FALSE;

-- 2. Adicionar índice para melhorar performance da query
CREATE INDEX IF NOT EXISTS idx_notifications_queue_sent_to_whatsapp 
ON public.notifications_queue(sent_to_whatsapp, type, created_at) 
WHERE status IN ('pending', 'processed');

-- 3. Corrigir a função process_overdue_slas para adicionar logging detalhado
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_record RECORD;
  tempo_pausado INTERVAL;
  data_limite_efetiva TIMESTAMPTZ;
  tickets_processados INTEGER := 0;
  notification_id UUID;
BEGIN
  RAISE NOTICE '🕐 [SLA] Iniciando verificação de SLAs vencidos às %', now();

  FOR ticket_record IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.data_limite_sla,
      t.sla_pausado,
      t.status,
      t.unidade_id,
      t.equipe_responsavel_id,
      u.grupo as unidade_nome
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status IN ('aberto', 'em_atendimento')
      AND t.data_limite_sla IS NOT NULL
      AND t.status_sla != 'vencido'
      AND t.sla_pausado = FALSE
  LOOP
    -- Calcular tempo pausado
    tempo_pausado := calcular_tempo_pausado(ticket_record.id);
    data_limite_efetiva := ticket_record.data_limite_sla + tempo_pausado;
    
    RAISE NOTICE '📊 [SLA] Ticket %: data_limite=%, tempo_pausado=%, data_limite_efetiva=%, now=%', 
      ticket_record.codigo_ticket,
      ticket_record.data_limite_sla,
      tempo_pausado,
      data_limite_efetiva,
      now();

    -- Verificar se o SLA efetivo está vencido
    IF data_limite_efetiva < now() THEN
      RAISE NOTICE '⚠️ [SLA] Ticket % VENCIDO! Atualizando status...', ticket_record.codigo_ticket;
      
      -- Atualizar status do ticket
      UPDATE tickets
      SET status_sla = 'vencido',
          escalonamento_nivel = COALESCE(escalonamento_nivel, 0) + 1
      WHERE id = ticket_record.id;

      -- Criar notificação de SLA vencido
      INSERT INTO notifications_queue (
        ticket_id,
        type,
        status,
        sent_to_whatsapp,
        payload
      ) VALUES (
        ticket_record.id,
        'sla_breach',
        'pending',
        FALSE,
        jsonb_build_object(
          'codigo_ticket', ticket_record.codigo_ticket,
          'titulo', ticket_record.titulo,
          'unidade_id', ticket_record.unidade_id,
          'unidade_nome', ticket_record.unidade_nome,
          'equipe_id', ticket_record.equipe_responsavel_id,
          'data_limite_original', ticket_record.data_limite_sla,
          'tempo_pausado_minutos', EXTRACT(EPOCH FROM tempo_pausado) / 60,
          'sla_efetivo_vencido_em', data_limite_efetiva,
          'escalonamento_nivel', COALESCE(ticket_record.equipe_responsavel_id, 0) + 1
        )
      )
      ON CONFLICT (ticket_id, type) WHERE type IN ('sla_breach')
      DO UPDATE SET
        status = 'pending',
        sent_to_whatsapp = FALSE,
        created_at = now(),
        payload = EXCLUDED.payload
      RETURNING id INTO notification_id;

      RAISE NOTICE '🔔 [SLA] Notificação criada: notification_id=%, ticket=%, status=pending, sent_to_whatsapp=FALSE', 
        notification_id,
        ticket_record.codigo_ticket;

      -- Log da ação
      PERFORM log_sla_action(
        ticket_record.id,
        'SLA vencido',
        jsonb_build_object(
          'data_limite_efetiva', data_limite_efetiva,
          'tempo_pausado_minutos', EXTRACT(EPOCH FROM tempo_pausado) / 60,
          'notification_id', notification_id
        )
      );

      tickets_processados := tickets_processados + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ [SLA] Processamento concluído: % tickets com SLA vencido', tickets_processados;
  RETURN tickets_processados;
END;
$$;

-- 4. Atualizar notificações antigas que não foram enviadas
UPDATE public.notifications_queue
SET sent_to_whatsapp = FALSE
WHERE sent_to_whatsapp IS NULL;

-- 5. Log da migration
SELECT log_system_action(
  'sistema'::log_tipo,
  'notifications_queue',
  'migration',
  'Adicionada coluna sent_to_whatsapp e corrigido process_overdue_slas',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object('migration', '20251013_fix_sla_notifications'),
  'web'::log_canal
);