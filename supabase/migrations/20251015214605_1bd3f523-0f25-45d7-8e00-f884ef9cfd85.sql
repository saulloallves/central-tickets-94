-- ============================================================================
-- CORREÇÃO COMPLETA DO SISTEMA DE NOTIFICAÇÕES E SLA (VERSÃO FINAL)
-- ============================================================================

-- 1. DROP E RECRIAR decrementar_sla_minutos() com assinatura correta
DROP FUNCTION IF EXISTS decrementar_sla_minutos();

CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER := 0;
BEGIN
  UPDATE tickets
  SET 
    sla_minutos_restantes = GREATEST(sla_minutos_restantes - 1, 0),
    status_sla = CASE 
      WHEN sla_minutos_restantes - 1 <= 0 THEN 'vencido'::ticket_sla_status
      WHEN sla_minutos_restantes - 1 <= (sla_minutos_totais / 2) THEN 'atencao'::ticket_sla_status
      ELSE 'dentro_prazo'::ticket_sla_status
    END,
    sla_vencido_em = CASE
      WHEN sla_minutos_restantes - 1 <= 0 AND sla_vencido_em IS NULL THEN NOW()
      ELSE sla_vencido_em
    END,
    sla_ultima_atualizacao = NOW()
  WHERE status IN ('aberto', 'em_atendimento')
    AND sla_pausado = FALSE
    AND sla_pausado_mensagem = FALSE
    AND sla_minutos_restantes > 0;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  
  IF v_affected > 0 THEN
    RAISE NOTICE '⏱️ Decrementado SLA de % tickets', v_affected;
  END IF;

  RETURN v_affected;
END;
$$;

-- 2. CORRIGIR process_overdue_slas() - Usar id_grupo_notificacoes
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_tickets_afetados INTEGER := 0;
BEGIN
  RAISE NOTICE '🚨 Iniciando processamento de SLAs vencidos...';

  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.status,
      t.sla_minutos_restantes,
      t.unidade_id,
      u.id_grupo_notificacoes,
      u.grupo as unidade_nome
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.status IN ('aberto', 'em_atendimento')
      AND t.sla_pausado = FALSE
      AND t.sla_pausado_mensagem = FALSE
      AND (
        (t.sla_minutos_restantes IS NOT NULL AND t.sla_minutos_restantes <= 0)
        OR (t.data_limite_sla IS NOT NULL AND NOW() >= t.data_limite_sla)
      )
  LOOP
    UPDATE tickets 
    SET 
      status = 'escalonado'::ticket_status,
      status_sla = 'vencido'::ticket_sla_status,
      sla_vencido_em = COALESCE(sla_vencido_em, NOW()),
      updated_at = NOW()
    WHERE id = v_ticket.id;

    INSERT INTO notifications_queue (ticket_id, type, payload, status)
    VALUES (
      v_ticket.id,
      'sla_breach',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'unidade_id', v_ticket.unidade_id,
        'unidade_nome', v_ticket.unidade_nome,
        'id_grupo_notificacoes', v_ticket.id_grupo_notificacoes,
        'sla_vencido_em', NOW()
      ),
      'pending'
    )
    ON CONFLICT (ticket_id, type) WHERE type IN ('sla_breach') DO NOTHING;

    v_tickets_afetados := v_tickets_afetados + 1;

    RAISE NOTICE '⏰ Ticket % (%) - SLA vencido! Status alterado para ESCALONADO', 
      v_ticket.codigo_ticket, v_ticket.id;
  END LOOP;

  RAISE NOTICE '✅ Processamento concluído. % tickets processados', v_tickets_afetados;
  RETURN v_tickets_afetados;
END;
$$;

-- 3. CRIAR FUNÇÃO AUXILIAR PARA VERIFICAR HORÁRIO COMERCIAL
CREATE OR REPLACE FUNCTION is_business_hours()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hora_atual TIME;
  v_dia_semana INTEGER;
BEGIN
  v_hora_atual := (NOW() AT TIME ZONE 'America/Sao_Paulo')::TIME;
  v_dia_semana := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  
  IF v_dia_semana IN (0, 6) THEN
    RETURN FALSE;
  END IF;
  
  IF v_hora_atual >= '08:30:00'::TIME AND v_hora_atual < '18:30:00'::TIME THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- 4. CRIAR TRIGGER PARA PAUSAR AUTOMATICAMENTE TICKETS CRIADOS FORA DO HORÁRIO
CREATE OR REPLACE FUNCTION check_initial_sla_pause()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_business_hours BOOLEAN;
BEGIN
  v_is_business_hours := is_business_hours();
  
  IF NOT v_is_business_hours THEN
    RAISE NOTICE '🌙 Ticket % criado FORA do horário comercial - pausando SLA', NEW.codigo_ticket;
    
    NEW.sla_pausado := TRUE;
    NEW.sla_pausado_em := NOW();
    
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'tickets',
      NEW.id::TEXT,
      'Ticket criado fora do horário comercial - SLA pausado automaticamente',
      NULL, NULL, NULL, NULL,
      NULL,
      jsonb_build_object(
        'sla_pausado', TRUE,
        'horario_criacao', NOW()
      ),
      'web'::log_canal
    );
  ELSE
    RAISE NOTICE '☀️ Ticket % criado DENTRO do horário comercial - SLA ativo', NEW.codigo_ticket;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_initial_sla_pause ON tickets;

CREATE TRIGGER trigger_check_initial_sla_pause
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_initial_sla_pause();

-- 5. CRIAR FUNÇÃO PARA PAUSAR TODOS OS TICKETS (CORRIGIDA)
CREATE OR REPLACE FUNCTION pausar_todos_tickets_abertos()
RETURNS TABLE(tickets_pausados INTEGER, detalhes JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tickets_pausados INTEGER := 0;
  v_ticket RECORD;
  v_detalhes JSONB := '[]'::JSONB;
  v_primeiro_ticket_id TEXT := NULL;
BEGIN
  RAISE NOTICE '⏸️ Iniciando pausa de todos os tickets abertos/em atendimento...';
  
  FOR v_ticket IN
    SELECT id, codigo_ticket, status, sla_minutos_restantes
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento')
      AND sla_pausado = FALSE
      AND sla_pausado_mensagem = FALSE
  LOOP
    UPDATE tickets
    SET 
      sla_pausado = TRUE,
      sla_pausado_em = NOW(),
      updated_at = NOW()
    WHERE id = v_ticket.id;
    
    v_tickets_pausados := v_tickets_pausados + 1;
    
    -- Guardar o primeiro ticket ID para usar no log
    IF v_primeiro_ticket_id IS NULL THEN
      v_primeiro_ticket_id := v_ticket.id::TEXT;
    END IF;
    
    v_detalhes := v_detalhes || jsonb_build_object(
      'codigo_ticket', v_ticket.codigo_ticket,
      'status', v_ticket.status,
      'sla_minutos_restantes', v_ticket.sla_minutos_restantes
    );
    
    RAISE NOTICE '✅ Ticket % pausado', v_ticket.codigo_ticket;
  END LOOP;
  
  -- CORRIGIDO: Usar primeiro ticket ID ao invés de NULL
  IF v_primeiro_ticket_id IS NOT NULL THEN
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'tickets',
      v_primeiro_ticket_id,  -- CORRIGIDO: usar ID válido
      'Pausa manual de todos os tickets abertos/em atendimento',
      NULL, NULL, NULL, NULL,
      NULL,
      jsonb_build_object(
        'tickets_pausados', v_tickets_pausados,
        'timestamp', NOW()
      ),
      'web'::log_canal
    );
  END IF;
  
  RAISE NOTICE '✅ Total de tickets pausados: %', v_tickets_pausados;
  
  RETURN QUERY SELECT v_tickets_pausados, v_detalhes;
END;
$$;

-- 6. COMENTÁRIOS
COMMENT ON FUNCTION process_overdue_slas() IS 
  'Processa tickets com SLA vencido e muda status para escalonado. CORRIGIDO para usar id_grupo_notificacoes.';

COMMENT ON FUNCTION decrementar_sla_minutos() IS 
  'Decrementa SLA em minutos para tickets ativos. CORRIGIDO cast de enum ticket_sla_status.';

COMMENT ON FUNCTION is_business_hours() IS 
  'Verifica se o horário atual está dentro do horário comercial (8:30-18:30, seg-sex).';

COMMENT ON FUNCTION check_initial_sla_pause() IS 
  'Trigger que pausa automaticamente tickets criados fora do horário comercial.';

COMMENT ON FUNCTION pausar_todos_tickets_abertos() IS 
  'Pausa manualmente todos os tickets em aberto ou em atendimento.';

-- 7. EXECUTAR PAUSA INICIAL
DO $$
DECLARE
  v_resultado RECORD;
BEGIN
  SELECT * INTO v_resultado FROM pausar_todos_tickets_abertos();
  RAISE NOTICE '📊 Resultado da pausa inicial: % tickets pausados', v_resultado.tickets_pausados;
END $$;