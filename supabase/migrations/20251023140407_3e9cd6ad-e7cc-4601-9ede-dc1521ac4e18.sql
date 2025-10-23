-- ========================================
-- CORREÇÃO: data_limite_sla com Horário Comercial
-- ========================================

-- 1. Criar função para calcular data limite com minutos úteis
CREATE OR REPLACE FUNCTION calcular_data_limite_com_minutos_uteis(
  p_data_inicio TIMESTAMPTZ,
  p_minutos_uteis INTEGER
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_data_atual TIMESTAMPTZ;
  v_minutos_restantes INTEGER;
  v_minutos_dia INTEGER;
  v_hora TIME;
  v_dow INTEGER;
BEGIN
  v_data_atual := p_data_inicio;
  v_minutos_restantes := p_minutos_uteis;
  
  -- Ajustar para próximo horário útil se estiver fora
  v_hora := v_data_atual::TIME;
  v_dow := EXTRACT(DOW FROM v_data_atual);
  
  IF v_dow = 0 THEN
    -- Domingo -> próxima segunda 08:30
    v_data_atual := DATE_TRUNC('day', v_data_atual) + INTERVAL '1 day' + INTERVAL '8 hours 30 minutes';
  ELSIF v_hora < '08:30:00'::TIME THEN
    -- Antes do expediente -> 08:30 do mesmo dia
    v_data_atual := DATE_TRUNC('day', v_data_atual) + INTERVAL '8 hours 30 minutes';
  ELSIF v_hora >= '17:30:00'::TIME THEN
    -- Após expediente -> 08:30 do próximo dia útil
    v_data_atual := DATE_TRUNC('day', v_data_atual) + INTERVAL '1 day' + INTERVAL '8 hours 30 minutes';
    v_dow := EXTRACT(DOW FROM v_data_atual);
    IF v_dow = 0 THEN
      v_data_atual := v_data_atual + INTERVAL '1 day';
    END IF;
  END IF;
  
  -- Consumir minutos úteis dia a dia
  WHILE v_minutos_restantes > 0 LOOP
    v_dow := EXTRACT(DOW FROM v_data_atual);
    
    IF v_dow = 0 THEN
      -- Pula domingo
      v_data_atual := v_data_atual + INTERVAL '1 day';
      CONTINUE;
    END IF;
    
    -- Calcular minutos disponíveis no dia atual
    v_hora := v_data_atual::TIME;
    v_minutos_dia := EXTRACT(EPOCH FROM ('17:30:00'::TIME - v_hora)) / 60;
    
    IF v_minutos_restantes <= v_minutos_dia THEN
      -- Cabe no dia atual
      v_data_atual := v_data_atual + (v_minutos_restantes || ' minutes')::INTERVAL;
      v_minutos_restantes := 0;
    ELSE
      -- Vai para próximo dia útil
      v_minutos_restantes := v_minutos_restantes - v_minutos_dia;
      v_data_atual := DATE_TRUNC('day', v_data_atual) + INTERVAL '1 day' + INTERVAL '8 hours 30 minutes';
    END IF;
  END LOOP;
  
  RETURN v_data_atual;
END;
$$;

-- 2. Atualizar trigger tickets_before_insert
CREATE OR REPLACE FUNCTION tickets_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Definir sla_minutos_totais conforme prioridade
  CASE new.prioridade
    WHEN 'urgente' THEN new.sla_minutos_totais := 10;
    WHEN 'alta' THEN new.sla_minutos_totais := 60;
    WHEN 'alto' THEN new.sla_minutos_totais := 60;
    WHEN 'crise' THEN new.sla_minutos_totais := 5;
    WHEN 'medio' THEN new.sla_minutos_totais := 600;  -- 10h
    WHEN 'baixo' THEN new.sla_minutos_totais := 1400; -- ~23h úteis
    ELSE new.sla_minutos_totais := 1400;
  END CASE;

  -- Calcular data_limite_sla com minutos úteis (sempre dentro do expediente)
  new.data_limite_sla := calcular_data_limite_com_minutos_uteis(
    new.data_abertura,
    new.sla_minutos_totais
  );

  -- Inicializar sla_minutos_restantes
  new.sla_minutos_restantes := new.sla_minutos_totais;

  -- Definir sla_pausado_horario se estiver fora do expediente
  DECLARE
    v_hora TIME := new.data_abertura::TIME;
    v_dow INTEGER := EXTRACT(DOW FROM new.data_abertura);
  BEGIN
    IF v_dow = 0 OR v_hora < '08:30:00'::TIME OR v_hora >= '17:30:00'::TIME THEN
      new.sla_pausado_horario := true;
    ELSE
      new.sla_pausado_horario := false;
    END IF;
  END;

  RETURN new;
END;
$$;

-- 3. Atualizar trigger tickets_before_update
CREATE OR REPLACE FUNCTION tickets_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se prioridade mudou, recalcular SLA
  IF new.prioridade IS DISTINCT FROM old.prioridade THEN
    CASE new.prioridade
      WHEN 'urgente' THEN new.sla_minutos_totais := 10;
      WHEN 'alta' THEN new.sla_minutos_totais := 60;
      WHEN 'alto' THEN new.sla_minutos_totais := 60;
      WHEN 'crise' THEN new.sla_minutos_totais := 5;
      WHEN 'medio' THEN new.sla_minutos_totais := 600;
      WHEN 'baixo' THEN new.sla_minutos_totais := 1400;
      ELSE new.sla_minutos_totais := 1400;
    END CASE;

    -- Recalcular data_limite_sla com horário comercial
    new.data_limite_sla := calcular_data_limite_com_minutos_uteis(
      COALESCE(old.data_abertura, NOW()),
      new.sla_minutos_totais
    );

    -- Recalcular minutos restantes
    new.sla_minutos_restantes := calcular_minutos_uteis_restantes(new.data_limite_sla);
  END IF;

  RETURN new;
END;
$$;

-- 4. Recalcular tickets existentes (apenas ativos)
UPDATE tickets
SET data_limite_sla = calcular_data_limite_com_minutos_uteis(data_abertura, sla_minutos_totais)
WHERE status != 'concluido'
  AND data_limite_sla IS NOT NULL
  AND sla_minutos_totais IS NOT NULL;