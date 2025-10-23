-- Fix tickets_before_insert trigger to convert legacy priorities to valid enum values
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Convert legacy priority values to valid enum values BEFORE processing
  CASE new.prioridade
    WHEN 'urgente' THEN new.prioridade := 'imediato';
    WHEN 'alta' THEN new.prioridade := 'alto';
    WHEN 'ainda_hoje' THEN new.prioridade := 'medio';
    WHEN 'ate_18h' THEN new.prioridade := 'medio';
    WHEN 'hoje_18h' THEN new.prioridade := 'medio';
    WHEN 'ate_1_hora' THEN new.prioridade := 'alto';
    WHEN 'normal' THEN new.prioridade := 'medio';
    ELSE 
      -- Keep the value if it's already valid (baixo, medio, alto, imediato, crise)
      -- or default to baixo if it's unknown
      IF new.prioridade NOT IN ('baixo', 'medio', 'alto', 'imediato', 'crise') THEN
        new.prioridade := 'baixo';
      END IF;
  END CASE;

  -- Define sla_minutos_totais based on normalized priority
  CASE new.prioridade
    WHEN 'crise' THEN new.sla_minutos_totais := 5;
    WHEN 'imediato' THEN new.sla_minutos_totais := 15;
    WHEN 'alto' THEN new.sla_minutos_totais := 60;
    WHEN 'medio' THEN new.sla_minutos_totais := 600;  -- 10h
    WHEN 'baixo' THEN new.sla_minutos_totais := 1400; -- ~23h úteis
    ELSE new.sla_minutos_totais := 1400;
  END CASE;

  -- Calcular data_limite_sla com minutos úteis
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
$function$;