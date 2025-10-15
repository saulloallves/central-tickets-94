-- ==========================================
-- FASE 1: Adicionar campos de contador real
-- ==========================================

-- Adicionar novos campos para contador de minutos
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS sla_minutos_restantes INTEGER,
ADD COLUMN IF NOT EXISTS sla_minutos_totais INTEGER,
ADD COLUMN IF NOT EXISTS sla_ultima_atualizacao TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.tickets.sla_minutos_restantes IS 
'Minutos restantes de SLA - conta regressiva real que pausa/resume';

COMMENT ON COLUMN public.tickets.sla_minutos_totais IS 
'Total de minutos do SLA original (para calcular percentual)';

COMMENT ON COLUMN public.tickets.sla_ultima_atualizacao IS 
'Última vez que o contador de SLA foi atualizado';

-- ==========================================
-- FASE 2: Inicializar contador para tickets existentes
-- ==========================================

-- Função para calcular minutos restantes de tickets existentes
CREATE OR REPLACE FUNCTION calcular_minutos_restantes_inicial(p_ticket_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_data_abertura TIMESTAMPTZ;
  v_data_limite_sla TIMESTAMPTZ;
  v_tempo_pausado_minutos INTEGER;
  v_tempo_decorrido_total_minutos INTEGER;
  v_sla_total_minutos INTEGER;
  v_minutos_restantes INTEGER;
BEGIN
  -- Buscar dados do ticket
  SELECT 
    data_abertura,
    data_limite_sla,
    COALESCE(EXTRACT(EPOCH FROM tempo_pausado_total) / 60, 0)
  INTO 
    v_data_abertura,
    v_data_limite_sla,
    v_tempo_pausado_minutos
  FROM tickets
  WHERE id = p_ticket_id;
  
  -- Calcular SLA total em minutos
  v_sla_total_minutos := EXTRACT(EPOCH FROM (v_data_limite_sla - v_data_abertura)) / 60;
  
  -- Calcular tempo já decorrido (sem pausas)
  v_tempo_decorrido_total_minutos := EXTRACT(EPOCH FROM (NOW() - v_data_abertura)) / 60;
  
  -- Minutos restantes = total - (decorrido - pausado)
  v_minutos_restantes := v_sla_total_minutos - (v_tempo_decorrido_total_minutos - v_tempo_pausado_minutos);
  
  -- Não pode ser negativo na inicialização
  IF v_minutos_restantes < 0 THEN
    v_minutos_restantes := 0;
  END IF;
  
  RETURN v_minutos_restantes;
END;
$$;

-- Inicializar campos para todos os tickets ativos
UPDATE public.tickets
SET 
  sla_minutos_totais = EXTRACT(EPOCH FROM (data_limite_sla - data_abertura)) / 60,
  sla_minutos_restantes = calcular_minutos_restantes_inicial(id),
  sla_ultima_atualizacao = NOW()
WHERE status IN ('aberto', 'em_atendimento', 'escalonado')
  AND data_limite_sla IS NOT NULL;

-- ==========================================
-- FASE 3: Função para inicializar SLA em novos tickets
-- ==========================================

CREATE OR REPLACE FUNCTION inicializar_sla_minutos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sla_minutos INTEGER;
BEGIN
  -- Calcular SLA em minutos baseado na prioridade
  v_sla_minutos := get_sla_minutes_for_priority(NEW.prioridade);
  
  -- Inicializar campos de contador
  NEW.sla_minutos_totais := v_sla_minutos;
  NEW.sla_minutos_restantes := v_sla_minutos;
  NEW.sla_ultima_atualizacao := NOW();
  
  RETURN NEW;
END;
$$;

-- Trigger para inicializar em novos tickets
DROP TRIGGER IF EXISTS trg_inicializar_sla_minutos ON tickets;
CREATE TRIGGER trg_inicializar_sla_minutos
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION inicializar_sla_minutos();

-- ==========================================
-- FASE 4: Função para decrementar SLA (chamada pelo cron)
-- ==========================================

CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS TABLE(
  tickets_atualizados INTEGER,
  tickets_vencidos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket RECORD;
  v_minutos_decorridos INTEGER;
  v_tickets_atualizados INTEGER := 0;
  v_tickets_vencidos INTEGER := 0;
BEGIN
  -- Processar apenas tickets ativos e NÃO pausados
  FOR v_ticket IN
    SELECT 
      id,
      sla_minutos_restantes,
      sla_ultima_atualizacao,
      codigo_ticket
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento', 'escalonado')
      AND sla_pausado = FALSE
      AND sla_pausado_mensagem = FALSE
      AND sla_minutos_restantes IS NOT NULL
      AND sla_minutos_restantes > 0
  LOOP
    -- Calcular quantos minutos se passaram desde última atualização
    v_minutos_decorridos := EXTRACT(EPOCH FROM (NOW() - v_ticket.sla_ultima_atualizacao)) / 60;
    
    -- Se passou pelo menos 1 minuto, atualizar
    IF v_minutos_decorridos >= 1 THEN
      UPDATE tickets
      SET 
        sla_minutos_restantes = GREATEST(0, sla_minutos_restantes - v_minutos_decorridos::INTEGER),
        sla_ultima_atualizacao = NOW(),
        -- Atualizar status_sla baseado em percentual
        status_sla = CASE
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER) <= 0 THEN 'vencido'::sla_status
          WHEN (sla_minutos_restantes - v_minutos_decorridos::INTEGER)::DECIMAL / NULLIF(sla_minutos_totais, 0) < 0.5 THEN 'alerta'::sla_status
          ELSE 'dentro_prazo'::sla_status
        END
      WHERE id = v_ticket.id;
      
      v_tickets_atualizados := v_tickets_atualizados + 1;
      
      -- Verificar se venceu agora
      IF (v_ticket.sla_minutos_restantes - v_minutos_decorridos) <= 0 THEN
        v_tickets_vencidos := v_tickets_vencidos + 1;
        
        RAISE NOTICE '⏱️ SLA VENCIDO: Ticket % - minutos restantes: %', 
          v_ticket.codigo_ticket, 
          (v_ticket.sla_minutos_restantes - v_minutos_decorridos);
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_tickets_atualizados, v_tickets_vencidos;
END;
$$;

-- ==========================================
-- FASE 5: Atualizar process_overdue_slas para usar contador
-- ==========================================

CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result RECORD;
  v_ticket RECORD;
  v_notificacoes_criadas INTEGER := 0;
BEGIN
  -- Primeiro, decrementar minutos de todos os tickets ativos
  SELECT * INTO v_result FROM decrementar_sla_minutos();
  
  RAISE NOTICE '✅ Decrementados % tickets, % venceram agora', 
    v_result.tickets_atualizados, 
    v_result.tickets_vencidos;
  
  -- Agora processar tickets com SLA = 0 (vencidos)
  FOR v_ticket IN
    SELECT 
      id,
      codigo_ticket,
      unidade_id,
      prioridade,
      sla_minutos_restantes
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento', 'escalonado')
      AND sla_pausado = FALSE
      AND sla_pausado_mensagem = FALSE
      AND sla_minutos_restantes <= 0
      AND status_sla != 'vencido'
  LOOP
    -- Marcar como vencido
    UPDATE tickets
    SET status_sla = 'vencido'
    WHERE id = v_ticket.id;
    
    -- Criar notificação
    INSERT INTO notifications_queue (ticket_id, type, payload)
    VALUES (
      v_ticket.id,
      'sla_breach',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'unidade_id', v_ticket.unidade_id,
        'prioridade', v_ticket.prioridade,
        'sla_vencido_em', NOW(),
        'minutos_restantes', v_ticket.sla_minutos_restantes
      )
    )
    ON CONFLICT (ticket_id, type) 
    WHERE type IN ('sla_breach')
    DO NOTHING;
    
    v_notificacoes_criadas := v_notificacoes_criadas + 1;
  END LOOP;
  
  RETURN v_notificacoes_criadas;
END;
$$;

-- ==========================================
-- FASE 6: Simplificar trigger de pausa por mensagem
-- ==========================================

CREATE OR REPLACE FUNCTION auto_pause_sla_on_outgoing_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_business BOOLEAN;
BEGIN
  -- Mensagem de SAÍDA (suporte respondeu) → PAUSAR
  IF NEW.direcao = 'saida' THEN
    UPDATE tickets
    SET 
      sla_pausado_mensagem = TRUE,
      sla_pausado_em = NOW()
    WHERE id = NEW.ticket_id
      AND sla_pausado_mensagem = FALSE;
    
    -- Registrar pausa
    INSERT INTO pausas_sla (ticket_id, pausa_inicio, motivo, tipo_pausa)
    SELECT NEW.ticket_id, NOW(), 'Aguardando resposta franqueado', 'aguardando_franqueado'
    WHERE NOT EXISTS (
      SELECT 1 FROM pausas_sla 
      WHERE ticket_id = NEW.ticket_id 
        AND tipo_pausa = 'aguardando_franqueado'
        AND pausa_fim IS NULL
    );
  
  -- Mensagem de ENTRADA (franqueado respondeu) → DESPAUSAR
  ELSIF NEW.direcao = 'entrada' THEN
    is_business := is_business_hours();
    
    -- Despausar (dentro ou fora do horário)
    UPDATE tickets
    SET 
      sla_pausado_mensagem = FALSE,
      sla_pausado = CASE 
        WHEN is_business THEN FALSE 
        ELSE sla_pausado  -- Manter pausa de horário se fora do expediente
      END,
      sla_pausado_em = CASE 
        WHEN is_business THEN NULL 
        ELSE sla_pausado_em
      END,
      pode_despausar_as_0830 = CASE
        WHEN is_business THEN FALSE
        ELSE TRUE
      END,
      sla_ultima_atualizacao = NOW()  -- ✅ Resetar timestamp para recomeçar contagem
    WHERE id = NEW.ticket_id;
    
    -- Finalizar pausa de mensagem
    UPDATE pausas_sla
    SET pausa_fim = NOW()
    WHERE ticket_id = NEW.ticket_id 
      AND tipo_pausa = 'aguardando_franqueado'
      AND pausa_fim IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS auto_pause_sla_on_outgoing_message_trigger ON ticket_mensagens;
CREATE TRIGGER auto_pause_sla_on_outgoing_message_trigger
  AFTER INSERT ON ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION auto_pause_sla_on_outgoing_message();

-- ==========================================
-- FASE 7: Criar índice para performance
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_tickets_sla_contador_ativo
ON public.tickets(sla_minutos_restantes, sla_pausado, sla_pausado_mensagem)
WHERE status IN ('aberto', 'em_atendimento', 'escalonado')
  AND sla_minutos_restantes IS NOT NULL;

-- ==========================================
-- LOG
-- ==========================================

INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema'::log_tipo,
  'tickets',
  'migration',
  'Sistema de SLA migrado para contador de minutos real (sem recalculo de datas)',
  jsonb_build_object(
    'novo_sistema', 'contador_minutos',
    'campos_adicionados', ARRAY['sla_minutos_restantes', 'sla_minutos_totais', 'sla_ultima_atualizacao'],
    'funcoes_criadas', ARRAY['decrementar_sla_minutos', 'inicializar_sla_minutos'],
    'data_migracao', NOW()
  ),
  'web'::log_canal
);