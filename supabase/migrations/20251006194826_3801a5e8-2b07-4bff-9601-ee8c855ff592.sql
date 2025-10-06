-- Corrigir a função next_ticket_code para aceitar UUID
-- e a tabela ticket_sequences para usar UUID

-- Primeiro, dropar a função antiga
DROP FUNCTION IF EXISTS public.next_ticket_code(text);

-- Atualizar a tabela ticket_sequences para usar UUID
ALTER TABLE IF EXISTS public.ticket_sequences 
  ALTER COLUMN unidade_id TYPE uuid USING unidade_id::uuid;

-- Recriar a função com UUID
CREATE OR REPLACE FUNCTION public.next_ticket_code(p_unidade_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM now());
  next_num INTEGER;
  ticket_code TEXT;
  unidade_grupo TEXT;
BEGIN
  -- Buscar o código do grupo da unidade
  SELECT grupo INTO unidade_grupo
  FROM public.unidades
  WHERE id = p_unidade_id;
  
  IF unidade_grupo IS NULL THEN
    RAISE EXCEPTION 'Unidade não encontrada: %', p_unidade_id;
  END IF;
  
  -- Insert or update sequence for this unit/year
  INSERT INTO public.ticket_sequences (unidade_id, ano, ultimo_numero)
  VALUES (p_unidade_id, current_year, 1)
  ON CONFLICT (unidade_id, ano)
  DO UPDATE SET 
    ultimo_numero = ticket_sequences.ultimo_numero + 1,
    updated_at = now()
  RETURNING ultimo_numero INTO next_num;
  
  -- Generate ticket code: GRUPO-YEAR-0001
  ticket_code := unidade_grupo || '-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN ticket_code;
END;
$function$;