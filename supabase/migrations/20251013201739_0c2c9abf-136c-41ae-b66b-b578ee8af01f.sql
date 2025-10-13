-- Atualizar função next_ticket_code para adicionar hífen no formato
CREATE OR REPLACE FUNCTION public.next_ticket_code(p_unidade_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  next_num INTEGER;
  ticket_code TEXT;
  grupo_code TEXT;
BEGIN
  -- Buscar o código do grupo (4 dígitos)
  SELECT LPAD(COALESCE(codigo_grupo, '0000'), 4, '0') INTO grupo_code
  FROM public.unidades
  WHERE id = p_unidade_id;
  
  IF grupo_code IS NULL THEN
    RAISE EXCEPTION 'Unidade não encontrada: %', p_unidade_id;
  END IF;
  
  -- Incrementar sequência global do grupo (sem considerar ano)
  -- Usar ano = 0 como indicador de sequência global
  INSERT INTO public.ticket_sequences (unidade_id, ano, ultimo_numero)
  VALUES (p_unidade_id, 0, 1)
  ON CONFLICT (unidade_id, ano)
  DO UPDATE SET 
    ultimo_numero = ticket_sequences.ultimo_numero + 1,
    updated_at = now()
  RETURNING ultimo_numero INTO next_num;
  
  -- Validar limite de 9999 tickets por grupo
  IF next_num > 9999 THEN
    RAISE EXCEPTION 'Limite de tickets excedido para o grupo % (máximo: 9999)', grupo_code;
  END IF;
  
  -- Gerar código: [CODIGO_GRUPO_4_DIGITOS]-[SEQUENCIA_4_DIGITOS]
  -- Exemplo: 1659-0001
  ticket_code := grupo_code || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN ticket_code;
END;
$function$;