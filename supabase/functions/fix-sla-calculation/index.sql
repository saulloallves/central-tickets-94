-- ========================================
-- CORREÇÃO COMPLETA DO SISTEMA SLA
-- Execute este script manualmente ou via migration
-- ========================================

-- 1. CRIAR FUNÇÃO AUXILIAR: Calcular minutos úteis entre duas datas
CREATE OR REPLACE FUNCTION calcular_minutos_uteis_entre_datas(
  p_data_inicio TIMESTAMPTZ,
  p_data_fim TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_data_atual TIMESTAMPTZ;
  v_minutos_total INTEGER := 0;
  v_hora_inicio TIME;
  v_hora_fim TIME;
  v_minutos_dia INTEGER;
  v_dow INTEGER;
BEGIN
  -- Se data_fim <= data_inicio, retorna 0
  IF p_data_fim <= p_data_inicio THEN
    RETURN 0;
  END IF;
  
  v_data_atual := p_data_inicio;
  
  -- Percorre cada dia entre data_inicio e data_fim
  WHILE DATE_TRUNC('day', v_data_atual) <= DATE_TRUNC('day', p_data_fim) LOOP
    v_dow := EXTRACT(DOW FROM v_data_atual);
    
    -- Pula domingos (0)
    IF v_dow != 0 THEN
      -- Define horários do dia atual
      IF DATE_TRUNC('day', v_data_atual) = DATE_TRUNC('day', p_data_inicio) THEN
        -- Primeiro dia: começa da hora atual ou 08:30
        IF v_data_atual::TIME < '08:30:00'::TIME THEN
          v_hora_inicio := '08:30:00'::TIME;
        ELSIF v_data_atual::TIME > '17:30:00'::TIME THEN
          v_hora_inicio := '17:30:00'::TIME;
        ELSE
          v_hora_inicio := v_data_atual::TIME;
        END IF;
      ELSE
        v_hora_inicio := '08:30:00'::TIME;
      END IF;
      
      IF DATE_TRUNC('day', v_data_atual) = DATE_TRUNC('day', p_data_fim) THEN
        -- Último dia: termina na hora final ou 17:30
        IF p_data_fim::TIME > '17:30:00'::TIME THEN
          v_hora_fim := '17:30:00'::TIME;
        ELSIF p_data_fim::TIME < '08:30:00'::TIME THEN
          v_hora_fim := '08:30:00'::TIME;
        ELSE
          v_hora_fim := p_data_fim::TIME;
        END IF;
      ELSE
        v_hora_fim := '17:30:00'::TIME;
      END IF;
      
      -- Calcula minutos do dia
      v_minutos_dia := EXTRACT(EPOCH FROM (v_hora_fim - v_hora_inicio)) / 60;
      
      -- Soma apenas se for positivo
      IF v_minutos_dia > 0 THEN
        v_minutos_total := v_minutos_total + v_minutos_dia;
      END IF;
    END IF;
    
    -- Próximo dia
    v_data_atual := v_data_atual + INTERVAL '1 day';
    v_data_atual := DATE_TRUNC('day', v_data_atual) + INTERVAL '8 hours 30 minutes';
  END LOOP;
  
  RETURN GREATEST(0, v_minutos_total)::INTEGER;
END;
$$;

-- 2. CRIAR FUNÇÃO: Calcular minutos úteis restantes até data_limite_sla
CREATE OR REPLACE FUNCTION calcular_minutos_uteis_restantes(
  p_data_limite TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agora TIMESTAMPTZ;
  v_minutos_restantes INTEGER;
BEGIN
  v_agora := NOW();
  
  -- Se o limite já passou, retorna negativo
  IF p_data_limite < v_agora THEN
    v_minutos_restantes := -1 * calcular_minutos_uteis_entre_datas(p_data_limite, v_agora);
    RETURN v_minutos_restantes;
  END IF;
  
  -- Calcula minutos úteis entre agora e o limite
  v_minutos_restantes := calcular_minutos_uteis_entre_datas(v_agora, p_data_limite);
  
  RETURN v_minutos_restantes;
END;
$$;

-- 3. ATUALIZAR VIEW tickets_with_sla_info
CREATE OR REPLACE VIEW tickets_with_sla_info AS
SELECT 
  t.*,
  calcular_minutos_uteis_restantes(t.data_limite_sla) as sla_minutos_restantes_calculado,
  COALESCE(
    EXTRACT(EPOCH FROM t.sla_tempo_pausado_total) / 60,
    0
  )::INTEGER as sla_tempo_pausado_minutos,
  CASE 
    WHEN t.data_limite_sla IS NULL THEN false
    WHEN calcular_minutos_uteis_restantes(t.data_limite_sla) < 0 THEN true
    ELSE false
  END as sla_vencido,
  CASE 
    WHEN t.sla_minutos_totais > 0 AND t.data_limite_sla IS NOT NULL THEN
      GREATEST(0, LEAST(100, 
        ((t.sla_minutos_totais - calcular_minutos_uteis_restantes(t.data_limite_sla))::NUMERIC / t.sla_minutos_totais * 100)
      ))
    ELSE 0
  END as sla_percentual_consumido
FROM tickets t;

-- 4. DESABILITAR decrementar_sla_minutos()
CREATE OR REPLACE FUNCTION decrementar_sla_minutos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE NOTICE '⚠️ decrementar_sla_minutos() desabilitado - usando cálculo dinâmico via view';
  RETURN;
END;
$$;

-- 5. RECALCULAR tickets ativos
UPDATE tickets
SET sla_minutos_restantes = calcular_minutos_uteis_restantes(data_limite_sla)
WHERE status != 'concluido' AND data_limite_sla IS NOT NULL;
