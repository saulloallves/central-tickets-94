-- Função para vincular automaticamente tickets similares a uma crise
CREATE OR REPLACE FUNCTION public.vincular_tickets_similares_a_crise(
  p_crise_id UUID,
  p_equipe_id UUID,
  p_similar_terms TEXT[],
  p_created_since TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '2 hours'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_record RECORD;
  v_tickets_vinculados INT := 0;
  v_term TEXT;
BEGIN
  -- Buscar tickets não vinculados da mesma equipe
  FOR v_ticket_record IN
    SELECT DISTINCT t.id, t.codigo_ticket, t.titulo, t.descricao_problema
    FROM tickets t
    LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
    LEFT JOIN crises c ON ctl.crise_id = c.id AND c.is_active = true
    WHERE t.equipe_responsavel_id = p_equipe_id
      AND t.created_at >= p_created_since
      AND t.status IN ('aberto', 'em_atendimento', 'escalonado')
      AND ctl.crise_id IS NULL -- Não vinculados a crises ativas
  LOOP
    -- Verificar se o ticket contém termos similares
    FOREACH v_term IN ARRAY p_similar_terms LOOP
      IF (LOWER(v_ticket_record.descricao_problema) LIKE '%' || LOWER(v_term) || '%' 
          OR LOWER(v_ticket_record.titulo) LIKE '%' || LOWER(v_term) || '%')
      THEN
        -- Vincular ticket à crise
        INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
        VALUES (p_crise_id, v_ticket_record.id, NULL)
        ON CONFLICT (crise_id, ticket_id) DO NOTHING;
        
        -- Incrementar contador
        v_tickets_vinculados := v_tickets_vinculados + 1;
        
        -- Log da vinculação
        RAISE NOTICE 'Ticket % vinculado à crise %', v_ticket_record.codigo_ticket, p_crise_id;
        
        -- Sair do loop de termos para este ticket
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Atualizar contador na crise
  UPDATE public.crises
  SET tickets_count = (
    SELECT COUNT(*) 
    FROM crise_ticket_links 
    WHERE crise_id = p_crise_id
  ),
  updated_at = NOW()
  WHERE id = p_crise_id;

  RETURN v_tickets_vinculados;
END;
$function$;