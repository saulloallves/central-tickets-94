-- ========================================
-- CORREÇÃO: Enums e Query de Notificações SLA
-- ========================================

-- DROP das funções existentes
DROP FUNCTION IF EXISTS decrementar_sla_minutos();
DROP FUNCTION IF EXISTS process_overdue_slas();
DROP FUNCTION IF EXISTS sync_status_sla() CASCADE;

-- FASE 1: Recriar decrementar_sla_minutos() com enum correto
CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS TABLE(tickets_atualizados INTEGER, tickets_vencidos INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tickets_atualizados INTEGER;
  v_tickets_vencidos INTEGER;
BEGIN
  -- Atualiza tickets com SLA ativo (não pausados e não concluídos)
  UPDATE tickets
  SET 
    sla_minutos_restantes = sla_minutos_restantes - 1,
    atualizado_em = NOW(),
    status_sla = CASE 
      WHEN (sla_minutos_restantes - 1) <= 0 THEN 'vencido'::ticket_sla_status
      WHEN (sla_minutos_restantes - 1) <= 15 THEN 'crítico'::ticket_sla_status
      WHEN (sla_minutos_restantes - 1) <= 30 THEN 'alerta'::ticket_sla_status
      ELSE status_sla
    END,
    sla_vencido_em = CASE 
      WHEN (sla_minutos_restantes - 1) <= 0 AND sla_vencido_em IS NULL THEN NOW()
      ELSE sla_vencido_em
    END,
    dentro_prazo = CASE 
      WHEN (sla_minutos_restantes - 1) <= 0 THEN false
      ELSE dentro_prazo
    END
  WHERE 
    status != 'concluido'
    AND sla_minutos_restantes > 0
    AND NOT sla_pausado
    AND NOT sla_pausado_mensagem
    AND NOT sla_pausado_horario;

  GET DIAGNOSTICS v_tickets_atualizados = ROW_COUNT;

  -- Conta quantos tickets estão vencidos após a atualização
  SELECT COUNT(*)::INTEGER INTO v_tickets_vencidos
  FROM tickets
  WHERE status_sla = 'vencido' AND status != 'concluido';

  RAISE NOTICE 'Decrementou % tickets, % agora vencidos', v_tickets_atualizados, v_tickets_vencidos;

  RETURN QUERY SELECT v_tickets_atualizados, v_tickets_vencidos;
END;
$$;

-- FASE 2: Recriar process_overdue_slas() com query corrigida
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS TABLE(notificacoes_criadas INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket RECORD;
  v_notificacoes_criadas INTEGER := 0;
  v_numero_destino TEXT;
BEGIN
  RAISE NOTICE '🔍 Processando tickets vencidos...';

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
      u.fantasy_name as unidade_nome,
      u.franqueado_nome,
      u.numero_notificacao_sla
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status_sla = 'vencido'
      AND t.status != 'concluido'
      AND t.sla_vencido_em IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications_queue nq
        WHERE nq.ticket_id = t.id
          AND nq.type = 'sla_breach'
          AND nq.created_at >= t.sla_vencido_em
      )
  LOOP
    v_numero_destino := COALESCE(v_ticket.numero_notificacao_sla, '5511999999999');

    INSERT INTO notifications_queue (
      type,
      ticket_id,
      destination,
      message,
      status,
      metadata
    ) VALUES (
      'sla_breach',
      v_ticket.id,
      v_numero_destino,
      format(
        '🚨 *SLA VENCIDO* 🚨\n\n' ||
        '*Ticket:* %s\n' ||
        '*Título:* %s\n' ||
        '*Unidade:* %s\n' ||
        '*Franqueado:* %s\n' ||
        '*Prioridade:* %s\n' ||
        '*Status:* %s\n' ||
        '*Vencido em:* %s\n\n' ||
        '⚠️ Ação imediata necessária!',
        v_ticket.codigo_ticket,
        v_ticket.titulo,
        COALESCE(v_ticket.unidade_nome, 'N/A'),
        COALESCE(v_ticket.franqueado_nome, 'N/A'),
        v_ticket.prioridade,
        v_ticket.status,
        TO_CHAR(v_ticket.sla_vencido_em, 'DD/MM/YYYY HH24:MI')
      ),
      'pending',
      jsonb_build_object(
        'unidade_id', v_ticket.unidade_id,
        'escalonamento_nivel', v_ticket.escalonamento_nivel,
        'prioridade', v_ticket.prioridade
      )
    );

    v_notificacoes_criadas := v_notificacoes_criadas + 1;
    RAISE NOTICE '📬 Notificação criada para ticket % (destino: %)', v_ticket.codigo_ticket, v_numero_destino;
  END LOOP;

  RAISE NOTICE '✅ Total de notificações criadas: %', v_notificacoes_criadas;
  RETURN QUERY SELECT v_notificacoes_criadas;
END;
$$;

-- FASE 3: Recriar sync_status_sla() com enum correto
CREATE OR REPLACE FUNCTION sync_status_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Sincroniza status_sla baseado em sla_minutos_restantes
  IF NEW.sla_minutos_restantes <= 0 THEN
    NEW.status_sla := 'vencido'::ticket_sla_status;
    NEW.sla_vencido_em := COALESCE(NEW.sla_vencido_em, NOW());
    NEW.dentro_prazo := false;
  ELSIF NEW.sla_minutos_restantes <= 15 THEN
    NEW.status_sla := 'crítico'::ticket_sla_status;
  ELSIF NEW.sla_minutos_restantes <= 30 THEN
    NEW.status_sla := 'alerta'::ticket_sla_status;
  ELSE
    NEW.status_sla := 'normal'::ticket_sla_status;
    NEW.dentro_prazo := true;
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS sync_status_sla_trigger ON tickets;
CREATE TRIGGER sync_status_sla_trigger
  BEFORE UPDATE OF sla_minutos_restantes ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION sync_status_sla();