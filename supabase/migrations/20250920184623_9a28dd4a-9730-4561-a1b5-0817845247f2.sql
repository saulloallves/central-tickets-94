-- Criar função para buscar configurações dinâmicas de SLA
CREATE OR REPLACE FUNCTION public.get_sla_minutes_for_priority(p_prioridade ticket_prioridade)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sla_minutes INTEGER;
  settings_data JSONB;
BEGIN
  -- Buscar configurações ativas de SLA
  SELECT priority_matrix INTO settings_data
  FROM ai_classifier_advanced_settings
  WHERE ativo = true
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Se não encontrou configurações, usar valores padrão
  IF settings_data IS NULL THEN
    CASE p_prioridade
      WHEN 'imediato' THEN RETURN 15;
      WHEN 'alto' THEN RETURN 60;
      WHEN 'medio' THEN RETURN 600;
      WHEN 'baixo' THEN RETURN 1440;
      WHEN 'crise' THEN RETURN 5;
      ELSE RETURN 1440;
    END CASE;
  END IF;
  
  -- Extrair SLA da configuração JSON
  SELECT (settings_data -> p_prioridade::text -> 'sla_minutes')::INTEGER INTO sla_minutes;
  
  -- Se não encontrou a prioridade específica, usar padrão
  IF sla_minutes IS NULL THEN
    CASE p_prioridade
      WHEN 'imediato' THEN RETURN 15;
      WHEN 'alto' THEN RETURN 60;
      WHEN 'medio' THEN RETURN 600;
      WHEN 'baixo' THEN RETURN 1440;
      WHEN 'crise' THEN RETURN 5;
      ELSE RETURN 1440;
    END CASE;
  END IF;
  
  RETURN sla_minutes;
END;
$$;

-- Atualizar função auto_process_sla_on_insert para usar configurações dinâmicas
CREATE OR REPLACE FUNCTION public.auto_process_sla_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sla_minutes INTEGER;
BEGIN
  -- Definir data_limite_sla conforme prioridade APENAS se não foi definido pela edge function
  IF NEW.data_limite_sla IS NULL THEN
    -- Buscar SLA dinamicamente das configurações
    SELECT public.get_sla_minutes_for_priority(NEW.prioridade) INTO sla_minutes;
    
    -- Calcular data limite baseada nos minutos configurados
    NEW.data_limite_sla := NEW.data_abertura + (sla_minutes || ' minutes')::INTERVAL;
    
    RAISE NOTICE 'SLA definido dinamicamente: % minutos para prioridade %', 
      sla_minutes, NEW.prioridade;
  ELSE
    RAISE NOTICE 'SLA já definido pela edge function: % minutos', 
      EXTRACT(EPOCH FROM (NEW.data_limite_sla - NEW.data_abertura))/60;
  END IF;

  -- Verificar se ticket já nasce com SLA vencido
  IF NEW.data_limite_sla IS NOT NULL AND NEW.data_limite_sla < NOW() THEN
    NEW.status_sla := 'vencido';
    
    -- Se não for concluído, escalonar imediatamente
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
$$;