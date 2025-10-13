-- Função para verificar se está em horário comercial (América/São Paulo)
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  now_sao_paulo TIMESTAMPTZ;
  day_of_week INT;
  time_of_day TIME;
BEGIN
  now_sao_paulo := NOW() AT TIME ZONE 'America/Sao_Paulo';
  day_of_week := EXTRACT(DOW FROM now_sao_paulo);
  time_of_day := (now_sao_paulo AT TIME ZONE 'America/Sao_Paulo')::TIME;
  
  -- Domingo = 0
  IF day_of_week = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Segunda-Sábado: 08:30-18:30
  IF time_of_day >= '08:30:00' AND time_of_day <= '18:30:00' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Função para calcular próximo início de horário comercial
CREATE OR REPLACE FUNCTION public.get_next_business_hour_start()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  now_sao_paulo TIMESTAMPTZ;
  day_of_week INT;
  time_of_day TIME;
  next_start TIMESTAMPTZ;
BEGIN
  now_sao_paulo := NOW() AT TIME ZONE 'America/Sao_Paulo';
  day_of_week := EXTRACT(DOW FROM now_sao_paulo);
  time_of_day := (now_sao_paulo AT TIME ZONE 'America/Sao_Paulo')::TIME;
  
  -- Se é domingo, próximo início é segunda 08:30
  IF day_of_week = 0 THEN
    next_start := date_trunc('day', now_sao_paulo) + INTERVAL '1 day' + TIME '08:30:00';
  
  -- Se está antes das 08:30 hoje
  ELSIF time_of_day < '08:30:00' THEN
    next_start := date_trunc('day', now_sao_paulo) + TIME '08:30:00';
  
  -- Se está depois das 18:30 hoje
  ELSIF time_of_day > '18:30:00' THEN
    -- Se é sábado, próximo é segunda 08:30
    IF day_of_week = 6 THEN
      next_start := date_trunc('day', now_sao_paulo) + INTERVAL '2 days' + TIME '08:30:00';
    ELSE
      next_start := date_trunc('day', now_sao_paulo) + INTERVAL '1 day' + TIME '08:30:00';
    END IF;
  
  ELSE
    -- Está em horário comercial, retorna próximo dia útil 08:30
    IF day_of_week = 6 THEN
      next_start := date_trunc('day', now_sao_paulo) + INTERVAL '2 days' + TIME '08:30:00';
    ELSE
      next_start := date_trunc('day', now_sao_paulo) + INTERVAL '1 day' + TIME '08:30:00';
    END IF;
  END IF;
  
  RETURN next_start AT TIME ZONE 'America/Sao_Paulo';
EXCEPTION
  WHEN OTHERS THEN
    RETURN (NOW() + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

-- Trigger para ajustar SLA ao criar tickets fora do horário
CREATE OR REPLACE FUNCTION public.adjust_sla_for_business_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  in_business_hours BOOLEAN;
  next_business_start TIMESTAMPTZ;
  sla_minutes INT;
BEGIN
  -- Verificar se está em horário comercial
  in_business_hours := public.is_business_hours();
  
  IF NOT in_business_hours THEN
    -- Calcular próximo início
    next_business_start := public.get_next_business_hour_start();
    
    -- Obter SLA baseado na prioridade (usar função existente se disponível)
    sla_minutes := public.get_sla_minutes_for_priority(NEW.prioridade);
    
    -- Ajustar data limite SLA: próximo horário comercial + SLA normal
    NEW.data_limite_sla := next_business_start + (sla_minutes || ' minutes')::INTERVAL;
    NEW.sla_half_time := next_business_start + ((sla_minutes / 2) || ' minutes')::INTERVAL;
    
    -- Marcar como pausado desde a criação
    NEW.sla_pausado := TRUE;
    NEW.sla_pausado_em := NOW();
    NEW.sla_pausado_mensagem := FALSE;
    
    -- Log da ação
    PERFORM public.log_sla_action(
      NEW.id,
      'Ticket criado fora do horário - SLA ajustado automaticamente',
      jsonb_build_object(
        'horario_criacao', NEW.data_abertura,
        'proximo_inicio_comercial', next_business_start,
        'sla_ajustado_para', NEW.data_limite_sla,
        'sla_minutes', sla_minutes,
        'prioridade', NEW.prioridade
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_adjust_sla_business_hours ON public.tickets;
CREATE TRIGGER trg_adjust_sla_business_hours
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_sla_for_business_hours();