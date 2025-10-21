-- ============================================================================
-- MIGRATION: Novo Sistema de SLA Baseado em Timestamps (v2 - com cast)
-- ============================================================================

-- 1. Adicionar novas colunas
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS sla_escalado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_escalado_nivel INTEGER DEFAULT 0;

-- 2. Criar função auxiliar para obter fim do expediente
CREATE OR REPLACE FUNCTION get_business_hour_end(p_date TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_date_sp TIMESTAMPTZ;
BEGIN
  v_date_sp := p_date AT TIME ZONE 'America/Sao_Paulo';
  RETURN (date_trunc('day', v_date_sp) + INTERVAL '17 hours 30 minutes') AT TIME ZONE 'America/Sao_Paulo';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Criar função auxiliar para obter início do próximo expediente
CREATE OR REPLACE FUNCTION get_next_business_hour_start_v2(p_date TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_next_day TIMESTAMPTZ;
  v_day_of_week INTEGER;
BEGIN
  v_next_day := date_trunc('day', p_date AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day';
  
  LOOP
    v_day_of_week := EXTRACT(DOW FROM v_next_day AT TIME ZONE 'America/Sao_Paulo');
    
    IF v_day_of_week = 0 THEN
      v_next_day := v_next_day + INTERVAL '1 day';
    ELSE
      RETURN (v_next_day + INTERVAL '8 hours 30 minutes') AT TIME ZONE 'America/Sao_Paulo';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Criar função para verificar se está em horário comercial
CREATE OR REPLACE FUNCTION is_business_hours_check(p_date TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
DECLARE
  v_hour INTEGER;
  v_minute INTEGER;
  v_day_of_week INTEGER;
  v_date_sp TIMESTAMPTZ;
BEGIN
  v_date_sp := p_date AT TIME ZONE 'America/Sao_Paulo';
  v_hour := EXTRACT(HOUR FROM v_date_sp);
  v_minute := EXTRACT(MINUTE FROM v_date_sp);
  v_day_of_week := EXTRACT(DOW FROM v_date_sp);
  
  IF v_day_of_week = 0 THEN
    RETURN FALSE;
  END IF;
  
  IF v_hour < 8 OR (v_hour = 8 AND v_minute < 30) THEN
    RETURN FALSE;
  END IF;
  
  IF v_hour >= 17 AND v_minute >= 30 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Criar função para adicionar minutos úteis
CREATE OR REPLACE FUNCTION adicionar_minutos_uteis(
  p_data_inicio TIMESTAMPTZ,
  p_minutos INTEGER
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_data_atual TIMESTAMPTZ := p_data_inicio;
  v_minutos_restantes INTEGER := p_minutos;
  v_fim_expediente TIMESTAMPTZ;
  v_tempo_disponivel_minutos INTEGER;
  v_day_of_week INTEGER;
BEGIN
  WHILE v_minutos_restantes > 0 LOOP
    v_day_of_week := EXTRACT(DOW FROM v_data_atual AT TIME ZONE 'America/Sao_Paulo');
    IF v_day_of_week = 0 THEN
      v_data_atual := get_next_business_hour_start_v2(v_data_atual);
      CONTINUE;
    END IF;
    
    IF NOT is_business_hours_check(v_data_atual) THEN
      v_data_atual := get_next_business_hour_start_v2(v_data_atual);
      CONTINUE;
    END IF;
    
    v_fim_expediente := get_business_hour_end(v_data_atual);
    v_tempo_disponivel_minutos := EXTRACT(EPOCH FROM (v_fim_expediente - v_data_atual))::INTEGER / 60;
    
    IF v_minutos_restantes <= v_tempo_disponivel_minutos THEN
      RETURN v_data_atual + (v_minutos_restantes || ' minutes')::INTERVAL;
    END IF;
    
    v_minutos_restantes := v_minutos_restantes - v_tempo_disponivel_minutos;
    v_data_atual := get_next_business_hour_start_v2(v_fim_expediente);
  END LOOP;
  
  RETURN v_data_atual;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Criar função para calcular data limite do SLA
CREATE OR REPLACE FUNCTION calcular_data_limite_sla(
  p_data_abertura TIMESTAMPTZ,
  p_prioridade TEXT
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_sla_minutos INTEGER;
  v_tempo_restante_hoje INTEGER;
  v_fim_expediente_hoje TIMESTAMPTZ;
  v_inicio_proximo_expediente TIMESTAMPTZ;
BEGIN
  v_sla_minutos := CASE p_prioridade
    WHEN 'crise' THEN 5
    WHEN 'imediato' THEN 15
    WHEN 'alto' THEN 60
    WHEN 'medio' THEN 600
    WHEN 'baixo' THEN 1440
    ELSE 1440
  END;
  
  IF NOT is_business_hours_check(p_data_abertura) THEN
    v_inicio_proximo_expediente := get_next_business_hour_start_v2(p_data_abertura);
    RETURN adicionar_minutos_uteis(v_inicio_proximo_expediente, v_sla_minutos);
  END IF;
  
  v_fim_expediente_hoje := get_business_hour_end(p_data_abertura);
  v_tempo_restante_hoje := EXTRACT(EPOCH FROM (v_fim_expediente_hoje - p_data_abertura))::INTEGER / 60;
  
  IF v_sla_minutos <= v_tempo_restante_hoje THEN
    RETURN p_data_abertura + (v_sla_minutos || ' minutes')::INTERVAL;
  END IF;
  
  v_inicio_proximo_expediente := get_next_business_hour_start_v2(v_fim_expediente_hoje);
  RETURN adicionar_minutos_uteis(
    v_inicio_proximo_expediente,
    v_sla_minutos - v_tempo_restante_hoje
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Criar trigger para calcular data_limite_sla automaticamente
CREATE OR REPLACE FUNCTION trigger_set_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prioridade IS NOT NULL AND NEW.data_abertura IS NOT NULL THEN
    NEW.data_limite_sla := calcular_data_limite_sla(
      NEW.data_abertura,
      NEW.prioridade::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sla_deadline_on_insert ON tickets;
CREATE TRIGGER set_sla_deadline_on_insert
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_sla_deadline();

-- 8. Criar view para cálculo de SLA em tempo real
DROP VIEW IF EXISTS tickets_with_sla_info;
CREATE OR REPLACE VIEW tickets_with_sla_info AS
SELECT 
  t.*,
  CASE 
    WHEN t.status = 'concluido' THEN NULL
    WHEN t.sla_pausado_horario THEN NULL
    WHEN t.data_limite_sla < NOW() THEN 
      -EXTRACT(EPOCH FROM (NOW() - t.data_limite_sla))::INTEGER / 60
    ELSE 
      EXTRACT(EPOCH FROM (t.data_limite_sla - NOW()))::INTEGER / 60
  END AS sla_minutos_restantes_calculado,
  
  CASE
    WHEN t.status = 'concluido' THEN 'concluido'
    WHEN t.sla_pausado_horario THEN 'pausado'
    WHEN t.data_limite_sla < NOW() THEN 'vencido'
    WHEN (EXTRACT(EPOCH FROM (t.data_limite_sla - NOW()))::INTEGER / 60) < 30 THEN 'critico'
    ELSE 'dentro_prazo'
  END AS status_sla_calculado,
  
  (t.data_limite_sla < NOW() AND NOT COALESCE(t.sla_pausado_horario, FALSE)) AS is_overdue_calculated

FROM tickets t;

-- 9. Recalcular data_limite_sla para todos os tickets existentes
UPDATE tickets
SET data_limite_sla = calcular_data_limite_sla(data_abertura, prioridade::TEXT)
WHERE status != 'concluido'
  AND data_abertura IS NOT NULL
  AND prioridade IS NOT NULL;

-- 10. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tickets_data_limite_sla ON tickets(data_limite_sla) WHERE status != 'concluido';
CREATE INDEX IF NOT EXISTS idx_tickets_sla_pausado_horario ON tickets(sla_pausado_horario) WHERE status != 'concluido';

-- 11. Dropar funções e triggers obsoletos
DROP TRIGGER IF EXISTS trigger_acumular_tempo_pausado ON tickets;
DROP FUNCTION IF EXISTS acumular_tempo_pausado() CASCADE;
DROP FUNCTION IF EXISTS decrementar_sla_minutos() CASCADE;
DROP FUNCTION IF EXISTS calcular_sla_tempo_real(UUID) CASCADE;
DROP FUNCTION IF EXISTS process_sla_half_warnings() CASCADE;
DROP VIEW IF EXISTS tickets_with_realtime_sla CASCADE;