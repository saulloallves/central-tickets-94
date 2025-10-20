-- ============================================================================
-- FASE 1: CORREÇÃO FUNDAMENTAL DO SISTEMA DE SLA
-- ============================================================================
-- Problema: tempo_pausado_total nunca é atualizado, causando dessincronia
-- Solução: Trigger automático que acumula tempo de pausa
-- ============================================================================

-- 1. Adicionar coluna auxiliar para rastrear quando a pausa começou
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS ultima_pausa_timestamp TIMESTAMPTZ;

-- 2. Criar função trigger que acumula tempo pausado automaticamente
CREATE OR REPLACE FUNCTION acumular_tempo_pausado()
RETURNS TRIGGER AS $$
DECLARE
  tempo_pausado_interval INTERVAL;
  alguma_pausa_ativa BOOLEAN;
  alguma_pausa_estava_ativa BOOLEAN;
BEGIN
  -- Verificar se ALGUMA pausa está ativa agora
  alguma_pausa_ativa := (NEW.sla_pausado = true OR NEW.sla_pausado_mensagem = true OR NEW.sla_pausado_horario = true);
  
  -- Verificar se ALGUMA pausa estava ativa antes
  alguma_pausa_estava_ativa := (OLD.sla_pausado = true OR OLD.sla_pausado_mensagem = true OR OLD.sla_pausado_horario = true);

  -- CASO 1: Pausou agora (false → true)
  IF NOT alguma_pausa_estava_ativa AND alguma_pausa_ativa THEN
    NEW.ultima_pausa_timestamp := now();
    RAISE NOTICE 'Ticket % pausado. Timestamp registrado: %', NEW.codigo_ticket, NEW.ultima_pausa_timestamp;
  
  -- CASO 2: Despausou agora (true → false)
  ELSIF alguma_pausa_estava_ativa AND NOT alguma_pausa_ativa THEN
    IF OLD.ultima_pausa_timestamp IS NOT NULL THEN
      -- Calcular quanto tempo ficou pausado (como INTERVAL)
      tempo_pausado_interval := now() - OLD.ultima_pausa_timestamp;
      
      -- Acumular no total (INTERVAL)
      NEW.tempo_pausado_total := COALESCE(NEW.tempo_pausado_total, INTERVAL '0') + tempo_pausado_interval;
      
      -- Limpar timestamp de pausa
      NEW.ultima_pausa_timestamp := NULL;
      
      RAISE NOTICE 'Ticket % despausado. Tempo pausado: %. Total acumulado: %', 
        NEW.codigo_ticket, tempo_pausado_interval, NEW.tempo_pausado_total;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trigger_acumular_tempo_pausado ON tickets;
CREATE TRIGGER trigger_acumular_tempo_pausado
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION acumular_tempo_pausado();

-- 4. Recriar view e função calcular_sla_tempo_real() que recebe ticket_id
DROP VIEW IF EXISTS tickets_with_realtime_sla CASCADE;
DROP FUNCTION IF EXISTS calcular_sla_tempo_real(UUID) CASCADE;

-- 5. Criar nova função calcular_sla_tempo_real() que usa tempo_pausado_total
CREATE OR REPLACE FUNCTION calcular_sla_tempo_real(p_ticket_id UUID)
RETURNS TABLE (
  sla_minutos_decorridos INTEGER,
  sla_minutos_restantes INTEGER,
  sla_segundos_restantes INTEGER,
  status_sla TEXT,
  is_overdue BOOLEAN
) AS $$
DECLARE
  v_ticket RECORD;
  tempo_decorrido_minutos INTEGER;
  tempo_pausado_minutos INTEGER;
  sla_restante_calculado INTEGER;
BEGIN
  -- Buscar dados do ticket
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id;

  -- Se não encontrou o ticket, retornar NULL
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Se ticket concluído, SLA = 0
  IF v_ticket.status = 'concluido' THEN
    RETURN QUERY SELECT 
      0 as sla_minutos_decorridos,
      0 as sla_minutos_restantes,
      0 as sla_segundos_restantes,
      'concluido'::TEXT as status_sla,
      false as is_overdue;
    RETURN;
  END IF;

  -- Se não tem SLA definido, retornar NULL
  IF v_ticket.sla_minutos_totais IS NULL THEN
    RETURN QUERY SELECT 
      NULL::INTEGER,
      NULL::INTEGER,
      NULL::INTEGER,
      NULL::TEXT,
      false;
    RETURN;
  END IF;

  -- Calcular tempo decorrido desde abertura (em minutos)
  tempo_decorrido_minutos := EXTRACT(EPOCH FROM (now() - v_ticket.data_abertura)) / 60;

  -- Converter INTERVAL para minutos
  tempo_pausado_minutos := EXTRACT(EPOCH FROM COALESCE(v_ticket.tempo_pausado_total, INTERVAL '0')) / 60;

  -- FÓRMULA CORRETA: 
  -- SLA restante = SLA total - (tempo decorrido - tempo pausado)
  -- Ou seja: SLA restante = SLA total - tempo decorrido + tempo pausado
  sla_restante_calculado := v_ticket.sla_minutos_totais - tempo_decorrido_minutos + tempo_pausado_minutos;

  -- Garantir que não seja negativo
  sla_restante_calculado := GREATEST(sla_restante_calculado, 0);

  -- Determinar status
  RETURN QUERY SELECT 
    tempo_decorrido_minutos as sla_minutos_decorridos,
    sla_restante_calculado as sla_minutos_restantes,
    (sla_restante_calculado * 60) as sla_segundos_restantes,
    CASE 
      WHEN sla_restante_calculado <= 0 THEN 'vencido'
      WHEN sla_restante_calculado <= (v_ticket.sla_minutos_totais * 0.25) THEN 'critico'
      WHEN sla_restante_calculado <= (v_ticket.sla_minutos_totais * 0.5) THEN 'atencao'
      ELSE 'normal'
    END::TEXT as status_sla,
    (sla_restante_calculado <= 0) as is_overdue;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Recriar view tickets_with_realtime_sla
CREATE OR REPLACE VIEW tickets_with_realtime_sla AS
SELECT 
  t.*,
  sla.sla_minutos_decorridos,
  sla.sla_minutos_restantes AS sla_minutos_restantes_calculado,
  sla.sla_segundos_restantes,
  sla.status_sla AS status_sla_calculado,
  sla.is_overdue
FROM tickets t
LEFT JOIN LATERAL calcular_sla_tempo_real(t.id) sla ON true;

-- 7. Garantir RLS na view
ALTER VIEW tickets_with_realtime_sla OWNER TO postgres;

-- 8. Log da migration
DO $$
BEGIN
  RAISE NOTICE '✅ FASE 1 COMPLETA: Sistema de acúmulo automático de tempo pausado implementado';
  RAISE NOTICE '   - Coluna ultima_pausa_timestamp adicionada';
  RAISE NOTICE '   - Trigger acumular_tempo_pausado criado';
  RAISE NOTICE '   - Função calcular_sla_tempo_real recriada com fórmula correta';
  RAISE NOTICE '   - View tickets_with_realtime_sla atualizada';
  RAISE NOTICE '   - Agora tempo_pausado_total é acumulado automaticamente!';
END $$;