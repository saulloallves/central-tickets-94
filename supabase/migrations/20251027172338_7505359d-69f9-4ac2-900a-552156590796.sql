-- ========================================
-- CORREÇÃO COMPLETA DO SISTEMA SLA
-- Resolve inconsistências de status_sla vs sla_minutos_restantes
-- ========================================

-- FASE 1: Dropar e recriar função decrementar_sla_minutos()
DROP FUNCTION IF EXISTS public.decrementar_sla_minutos();

CREATE OR REPLACE FUNCTION public.decrementar_sla_minutos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result RECORD;
  v_tickets_updated INTEGER := 0;
  v_tickets_vencidos INTEGER := 0;
BEGIN
  -- Atualizar tickets ativos que NÃO estão pausados
  WITH updated AS (
    UPDATE tickets
    SET 
      sla_minutos_restantes = sla_minutos_restantes - 1,
      -- ✅ NOVO: Atualizar status_sla quando ficar <= 0
      status_sla = CASE 
        WHEN (sla_minutos_restantes - 1) <= 0 THEN 'vencido'::ticket_sla_status
        WHEN (sla_minutos_restantes - 1) <= 15 THEN 'critico'::ticket_sla_status
        WHEN (sla_minutos_restantes - 1) <= 30 THEN 'alerta'::ticket_sla_status
        ELSE status_sla
      END,
      -- ✅ NOVO: Marcar timestamp de vencimento
      sla_vencido_em = CASE 
        WHEN (sla_minutos_restantes - 1) <= 0 AND sla_vencido_em IS NULL 
        THEN NOW()
        ELSE sla_vencido_em
      END,
      updated_at = NOW()
    WHERE status != 'concluido'
      AND NOT (
        COALESCE(sla_pausado, false) 
        OR COALESCE(sla_pausado_mensagem, false) 
        OR COALESCE(sla_pausado_horario, false)
      )
      AND sla_minutos_restantes > -1440
    RETURNING id, codigo_ticket, sla_minutos_restantes, status_sla
  )
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE sla_minutos_restantes <= 0) as vencidos
  INTO v_tickets_updated, v_tickets_vencidos
  FROM updated;

  RETURN jsonb_build_object(
    'tickets_atualizados', v_tickets_updated,
    'tickets_vencidos', v_tickets_vencidos,
    'timestamp', NOW()
  );
END;
$$;

-- FASE 2: Dropar e recriar função process_overdue_slas()
DROP FUNCTION IF EXISTS public.process_overdue_slas();

CREATE OR REPLACE FUNCTION public.process_overdue_slas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket RECORD;
  v_processed_count INTEGER := 0;
  v_notified_count INTEGER := 0;
  v_equipe RECORD;
  v_notification_id UUID;
BEGIN
  -- Processar tickets vencidos que não estão pausados
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.prioridade,
      t.status,
      t.status_sla,
      t.sla_minutos_restantes,
      t.sla_vencido_em,
      t.equipe_responsavel_id,
      t.unidade_id,
      t.escalonamento_nivel,
      u.nome as unidade_nome,
      u.franqueado_nome,
      u.numero_notificacao_sla
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE (
      -- ✅ NOVO: Buscar por status_sla OU minutos negativos
      t.status_sla = 'vencido'::ticket_sla_status
      OR t.sla_minutos_restantes <= 0
    )
    AND t.status NOT IN ('concluido', 'escalonado')
    AND NOT (
      COALESCE(t.sla_pausado, false) 
      OR COALESCE(t.sla_pausado_mensagem, false) 
      OR COALESCE(t.sla_pausado_horario, false)
    )
    ORDER BY t.sla_minutos_restantes ASC
    LIMIT 50
  LOOP
    -- ✅ GARANTIR que status_sla está correto antes de processar
    IF v_ticket.status_sla != 'vencido' THEN
      UPDATE tickets
      SET 
        status_sla = 'vencido'::ticket_sla_status,
        sla_vencido_em = COALESCE(sla_vencido_em, NOW()),
        updated_at = NOW()
      WHERE id = v_ticket.id;
    END IF;

    -- Determinar nível de escalonamento
    IF v_ticket.escalonamento_nivel IS NULL OR v_ticket.escalonamento_nivel = 0 THEN
      -- Primeiro escalonamento: para a equipe
      UPDATE tickets
      SET 
        escalonamento_nivel = 1,
        status = 'escalonado',
        updated_at = NOW()
      WHERE id = v_ticket.id;

      -- Criar notificação para a equipe
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        SELECT * INTO v_equipe
        FROM equipes
        WHERE id = v_ticket.equipe_responsavel_id;

        IF v_equipe.id IS NOT NULL THEN
          INSERT INTO notifications_queue (
            ticket_id,
            notification_type,
            destination_number,
            message,
            priority,
            status
          ) VALUES (
            v_ticket.id,
            'sla_breach',
            v_equipe.numero_notificacao,
            format(
              '🚨 *TICKET VENCIDO - ESCALONAMENTO NÍVEL 1*\n\n' ||
              '📋 Ticket: %s\n' ||
              '🏢 Unidade: %s\n' ||
              '⚡ Prioridade: %s\n' ||
              '⏰ Vencido há: %s minutos\n\n' ||
              '👥 Equipe: %s',
              v_ticket.codigo_ticket,
              v_ticket.unidade_nome,
              v_ticket.prioridade,
              ABS(v_ticket.sla_minutos_restantes),
              v_equipe.nome
            ),
            'high',
            'pending'
          )
          RETURNING id INTO v_notification_id;
          
          v_notified_count := v_notified_count + 1;
        END IF;
      END IF;

    ELSIF v_ticket.escalonamento_nivel = 1 THEN
      -- Segundo escalonamento: para a unidade
      UPDATE tickets
      SET 
        escalonamento_nivel = 2,
        updated_at = NOW()
      WHERE id = v_ticket.id;

      -- Criar notificação para a unidade
      IF v_ticket.numero_notificacao_sla IS NOT NULL THEN
        INSERT INTO notifications_queue (
          ticket_id,
          notification_type,
          destination_number,
          message,
          priority,
          status
        ) VALUES (
          v_ticket.id,
          'sla_breach',
          v_ticket.numero_notificacao_sla,
          format(
            '🔴 *TICKET VENCIDO - ESCALONAMENTO NÍVEL 2*\n\n' ||
            '📋 Ticket: %s\n' ||
            '🏢 Unidade: %s\n' ||
            '👤 Franqueado: %s\n' ||
            '⚡ Prioridade: %s\n' ||
            '⏰ Vencido há: %s minutos\n\n' ||
            '⚠️ Requer atenção imediata!',
            v_ticket.codigo_ticket,
            v_ticket.unidade_nome,
            v_ticket.franqueado_nome,
            v_ticket.prioridade,
            ABS(v_ticket.sla_minutos_restantes)
          ),
          'critical',
          'pending'
        )
        RETURNING id INTO v_notification_id;
        
        v_notified_count := v_notified_count + 1;
      END IF;
    END IF;

    v_processed_count := v_processed_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'tickets_processados', v_processed_count,
    'notificacoes_criadas', v_notified_count,
    'timestamp', NOW()
  );
END;
$$;

-- FASE 3: Corrigir tickets já inconsistentes no banco
UPDATE tickets
SET 
  status_sla = 'vencido'::ticket_sla_status,
  sla_vencido_em = COALESCE(sla_vencido_em, NOW()),
  updated_at = NOW()
WHERE sla_minutos_restantes <= 0
  AND status_sla != 'vencido'
  AND status != 'concluido'
  AND NOT (
    COALESCE(sla_pausado, false) 
    OR COALESCE(sla_pausado_mensagem, false) 
    OR COALESCE(sla_pausado_horario, false)
  );

-- FASE 4: Criar trigger para prevenir inconsistências futuras
CREATE OR REPLACE FUNCTION sync_status_sla()
RETURNS TRIGGER AS $$
BEGIN
  -- Sincronizar status_sla com sla_minutos_restantes
  IF NEW.sla_minutos_restantes <= 0 THEN
    NEW.status_sla := 'vencido'::ticket_sla_status;
    NEW.sla_vencido_em := COALESCE(NEW.sla_vencido_em, NOW());
  ELSIF NEW.sla_minutos_restantes <= 15 THEN
    NEW.status_sla := 'critico'::ticket_sla_status;
  ELSIF NEW.sla_minutos_restantes <= 30 THEN
    NEW.status_sla := 'alerta'::ticket_sla_status;
  ELSIF NEW.sla_minutos_restantes > 30 THEN
    NEW.status_sla := 'dentro_prazo'::ticket_sla_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropar trigger se já existir
DROP TRIGGER IF EXISTS ensure_status_sla_consistency ON tickets;

-- Aplicar trigger ANTES de UPDATE
CREATE TRIGGER ensure_status_sla_consistency
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  WHEN (NEW.sla_minutos_restantes IS DISTINCT FROM OLD.sla_minutos_restantes)
  EXECUTE FUNCTION sync_status_sla();

-- Comentários explicativos
COMMENT ON FUNCTION decrementar_sla_minutos() IS 'Decrementa SLA e atualiza status_sla automaticamente quando minutos <= 0';
COMMENT ON FUNCTION process_overdue_slas() IS 'Processa tickets vencidos usando status_sla OU minutos negativos como critério';
COMMENT ON FUNCTION sync_status_sla() IS 'Trigger que garante consistência entre sla_minutos_restantes e status_sla';
COMMENT ON TRIGGER ensure_status_sla_consistency ON tickets IS 'Mantém status_sla sincronizado com sla_minutos_restantes';