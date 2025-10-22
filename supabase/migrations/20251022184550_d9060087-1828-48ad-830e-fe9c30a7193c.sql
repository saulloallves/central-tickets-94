-- Fix 'imediato' priority SLA from 15min to 30min
-- This corrects a bug in the tickets_before_insert() trigger

-- Step 1: Fix the trigger to use 30 minutes for 'imediato' priority
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sla_minutes INTEGER := NULL;
  advanced_settings RECORD;
BEGIN
  new.updated_at := now();

  -- Generate ticket code if not provided
  IF new.codigo_ticket IS NULL THEN
    new.codigo_ticket := public.next_ticket_code(new.unidade_id);
  END IF;

  -- Auto-assign franqueado_id if missing
  IF new.franqueado_id IS NULL THEN
    SELECT f.id INTO new.franqueado_id
    FROM public.franqueados f
    INNER JOIN public.franqueados_unidades fu ON fu.franqueado_id = f.id
    WHERE fu.unidade_id = new.unidade_id
    LIMIT 1;
  END IF;

  -- Set data_limite_sla by consulting AI Classifier Advanced Settings
  IF new.data_limite_sla IS NULL THEN
    -- First try to get settings from AI Classifier Advanced
    BEGIN
      SELECT * INTO advanced_settings 
      FROM public.ai_classifier_advanced_settings 
      WHERE ativo = true 
      ORDER BY created_at DESC 
      LIMIT 1;
      
      -- If found settings AND priority exists in matrix
      IF advanced_settings IS NOT NULL AND 
         advanced_settings.priority_matrix ? new.prioridade::text THEN
        
        -- Extract SLA minutes from configuration
        sla_minutes := (advanced_settings.priority_matrix -> new.prioridade::text ->> 'sla_minutes')::INTEGER;
        
        RAISE LOG 'SLA found in advanced config for priority %: % minutes', new.prioridade, sla_minutes;
      ELSE
        RAISE LOG 'Advanced config not found or missing priority %. Using fallback.', new.prioridade;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'Error fetching advanced config: %. Using fallback.', SQLERRM;
        sla_minutes := NULL;
    END;
    
    -- If couldn't get from config, use fallback
    IF sla_minutes IS NULL OR sla_minutes <= 0 THEN
      CASE new.prioridade
        WHEN 'imediato' THEN 
          sla_minutes := 30;  -- FIXED: 15 → 30 minutes
        WHEN 'alto' THEN 
          sla_minutes := 60;
        WHEN 'medio' THEN 
          sla_minutes := 600;
        WHEN 'baixo' THEN 
          sla_minutes := 1440;
        WHEN 'crise' THEN 
          sla_minutes := 5;
        ELSE
          sla_minutes := 1440;
      END CASE;
      
      RAISE LOG 'Using fallback SLA for priority %: % minutes', new.prioridade, sla_minutes;
    END IF;
    
    -- Apply the SLA (from config or fallback)
    new.data_limite_sla := new.data_abertura + (sla_minutes || ' minutes')::INTERVAL;
    new.sla_minutos_totais := sla_minutes;
    new.sla_minutos_restantes := sla_minutes;
    
    RAISE LOG 'Ticket % created with SLA of % minutes (limit: %)', new.codigo_ticket, sla_minutes, new.data_limite_sla;
  END IF;

  -- Calculate SLA status
  IF now() >= new.data_limite_sla THEN
    new.status_sla := 'vencido';
  ELSIF now() >= (new.data_limite_sla - interval '2 hours') THEN
    new.status_sla := 'alerta';
  ELSE
    new.status_sla := 'dentro_prazo';
  END IF;

  -- Half time for 50% notification
  new.sla_half_time := new.data_abertura + ((new.data_limite_sla - new.data_abertura) / 2);

  RETURN new;
END;
$function$;

COMMENT ON FUNCTION public.tickets_before_insert() IS 
'Trigger to initialize ticket fields before insertion. 
SLA priorities:
- crise: 5min
- imediato: 30min
- alto: 60min
- medio: 600min (10h)
- baixo: 1440min (24h)';

-- Step 2: Fix existing 'imediato' tickets that were created with 15 minutes instead of 30
UPDATE tickets
SET 
  data_limite_sla = data_abertura + interval '30 minutes',
  sla_minutos_restantes = CASE 
    WHEN status = 'concluido' THEN sla_minutos_restantes
    ELSE sla_minutos_restantes + 15
  END,
  updated_at = NOW()
WHERE prioridade = 'imediato'
  AND sla_minutos_totais = 30
  AND EXTRACT(EPOCH FROM (data_limite_sla - data_abertura)) / 60 BETWEEN 14 AND 16  -- Only fix those with ~15min
  AND status != 'concluido';

-- Log the results
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % "imediato" tickets that had 15min SLA instead of 30min', affected_count;
END $$;