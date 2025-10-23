-- Correct the tickets_before_insert trigger to use next_ticket_code function
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log original priority for debugging
  RAISE NOTICE 'Trigger received priority: %', new.prioridade::text;
  
  -- Convert legacy priority values with explicit text casting
  CASE new.prioridade::text
    WHEN 'urgente' THEN 
      new.prioridade := 'imediato'::ticket_prioridade;
      RAISE NOTICE 'Converted urgente -> imediato';
    WHEN 'alta' THEN 
      new.prioridade := 'alto'::ticket_prioridade;
      RAISE NOTICE 'Converted alta -> alto';
    WHEN 'media' THEN 
      new.prioridade := 'medio'::ticket_prioridade;
      RAISE NOTICE 'Converted media -> medio';
    WHEN 'baixa' THEN 
      new.prioridade := 'baixo'::ticket_prioridade;
      RAISE NOTICE 'Converted baixa -> baixo';
    WHEN 'ainda_hoje' THEN 
      new.prioridade := 'medio'::ticket_prioridade;
      RAISE NOTICE 'Converted ainda_hoje -> medio';
    WHEN 'ate_18h' THEN 
      new.prioridade := 'medio'::ticket_prioridade;
      RAISE NOTICE 'Converted ate_18h -> medio';
    WHEN 'hoje_18h' THEN 
      new.prioridade := 'medio'::ticket_prioridade;
      RAISE NOTICE 'Converted hoje_18h -> medio';
    WHEN 'ate_1_hora' THEN 
      new.prioridade := 'alto'::ticket_prioridade;
      RAISE NOTICE 'Converted ate_1_hora -> alto';
    WHEN 'normal' THEN 
      new.prioridade := 'medio'::ticket_prioridade;
      RAISE NOTICE 'Converted normal -> medio';
    WHEN 'posso_esperar' THEN 
      new.prioridade := 'baixo'::ticket_prioridade;
      RAISE NOTICE 'Converted posso_esperar -> baixo';
    WHEN 'padrao_24h' THEN 
      new.prioridade := 'baixo'::ticket_prioridade;
      RAISE NOTICE 'Converted padrao_24h -> baixo';
    ELSE
      -- Verify if it's a valid priority, if not default to baixo
      IF new.prioridade::text NOT IN ('baixo', 'medio', 'alto', 'imediato', 'crise') THEN
        RAISE WARNING 'Invalid priority detected: %, defaulting to baixo', new.prioridade::text;
        new.prioridade := 'baixo'::ticket_prioridade;
      END IF;
  END CASE;
  
  -- Generate ticket code using the existing next_ticket_code function
  IF new.codigo_ticket IS NULL OR new.codigo_ticket = '' THEN
    new.codigo_ticket := next_ticket_code(new.unidade_id);
  END IF;
  
  RETURN new;
END;
$function$;