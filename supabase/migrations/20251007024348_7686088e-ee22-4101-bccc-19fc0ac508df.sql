-- Atualizar função para pausar SLA automaticamente fora do horário comercial
CREATE OR REPLACE FUNCTION public.auto_process_sla_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sla_minutes INTEGER;
  sp_time TIMESTAMP WITH TIME ZONE;
  day_of_week INT;
  hour INT;
  minutes INT;
  time_in_minutes INT;
  is_business_hours BOOLEAN;
BEGIN
  -- Obter horário de São Paulo
  sp_time := timezone('America/Sao_Paulo', NEW.data_abertura);
  day_of_week := EXTRACT(DOW FROM sp_time);
  hour := EXTRACT(HOUR FROM sp_time);
  minutes := EXTRACT(MINUTE FROM sp_time);
  time_in_minutes := hour * 60 + minutes;
  
  -- Verificar se está dentro do horário comercial (8h30-18h30, segunda a sábado)
  is_business_hours := (
    day_of_week >= 1 AND day_of_week <= 6 AND
    time_in_minutes >= 510 AND time_in_minutes < 1110
  );
  
  -- Definir data_limite_sla conforme prioridade APENAS se não foi definido pela edge function
  IF NEW.data_limite_sla IS NULL THEN
    SELECT public.get_sla_minutes_for_priority(NEW.prioridade) INTO sla_minutes;
    NEW.data_limite_sla := NEW.data_abertura + (sla_minutes || ' minutes')::INTERVAL;
    
    RAISE NOTICE 'SLA definido dinamicamente: % minutos para prioridade %', 
      sla_minutes, NEW.prioridade;
  ELSE
    RAISE NOTICE 'SLA já definido pela edge function: % minutos', 
      EXTRACT(EPOCH FROM (NEW.data_limite_sla - NEW.data_abertura))/60;
  END IF;

  -- NOVO: Pausar SLA se ticket criado fora do horário comercial
  IF NOT is_business_hours THEN
    NEW.sla_pausado := true;
    NEW.sla_pausado_em := NEW.data_abertura;
    
    RAISE NOTICE 'Ticket criado FORA do horário comercial - SLA PAUSADO';
    RAISE NOTICE 'Horário SP: %, Dia da semana: %, Hora: %:%', 
      sp_time, day_of_week, hour, minutes;
  ELSE
    NEW.sla_pausado := false;
    NEW.sla_pausado_em := NULL;
    
    RAISE NOTICE 'Ticket criado DENTRO do horário comercial - SLA ATIVO';
  END IF;

  -- Verificar se ticket já nasce com SLA vencido
  IF NEW.data_limite_sla IS NOT NULL AND NEW.data_limite_sla < NOW() THEN
    NEW.status_sla := 'vencido';
    
    IF NEW.status NOT IN ('escalonado', 'concluido') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1);
    END IF;
  ELSIF NOW() >= (NEW.data_limite_sla - INTERVAL '2 hours') THEN
    NEW.status_sla := 'alerta';
  ELSE
    NEW.status_sla := 'dentro_prazo';
  END IF;

  -- Meio do prazo para notificação de 50%
  NEW.sla_half_time := NEW.data_abertura + ((NEW.data_limite_sla - NEW.data_abertura) / 2);
  
  RETURN NEW;
END;
$function$;