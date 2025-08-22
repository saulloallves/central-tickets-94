-- Vincular todos os tickets similares do girabot à crise existente
DO $$
DECLARE
    v_crise_id UUID := 'bc719f37-4838-46db-a3e7-f0dd2b56b7ca';
    v_ticket_record RECORD;
BEGIN
    -- Buscar todos os tickets do girabot das últimas 2 horas
    FOR v_ticket_record IN
        SELECT t.id, t.codigo_ticket
        FROM tickets t
        WHERE t.data_abertura >= NOW() - INTERVAL '2 hours'
        AND LOWER(t.descricao_problema) LIKE '%girabot%'
        AND t.status != 'concluido'
        AND t.prioridade = 'crise'
    LOOP
        -- Atualizar ticket para escalonado se ainda não for
        UPDATE tickets 
        SET status = 'escalonado'::ticket_status
        WHERE id = v_ticket_record.id 
        AND status != 'escalonado';
        
        RAISE NOTICE 'Ticket % vinculado à crise', v_ticket_record.codigo_ticket;
    END LOOP;
    
    -- Atualizar log da crise
    UPDATE crises_ativas 
    SET log_acoes = log_acoes || jsonb_build_object(
        'acao', 'tickets_vinculados_automaticamente',
        'timestamp', NOW(),
        'total_tickets', (
            SELECT COUNT(*) 
            FROM tickets t
            WHERE t.data_abertura >= NOW() - INTERVAL '2 hours'
            AND LOWER(t.descricao_problema) LIKE '%girabot%'
            AND t.status != 'concluido'
            AND t.prioridade = 'crise'
        )
    )
    WHERE id = v_crise_id;
END $$;

-- Função para melhorar a detecção e agrupamento de crises
CREATE OR REPLACE FUNCTION public.group_similar_tickets_to_crisis(p_crisis_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    crisis_ticket_id UUID;
    similar_count INTEGER := 0;
    v_ticket_record RECORD;
    primary_keyword TEXT;
BEGIN
    -- Buscar ticket base da crise
    SELECT ticket_id INTO crisis_ticket_id 
    FROM crises_ativas 
    WHERE id = p_crisis_id;
    
    -- Extrair palavra-chave principal do ticket base
    SELECT LOWER(TRIM(SPLIT_PART(descricao_problema, ' ', 1))) INTO primary_keyword
    FROM tickets 
    WHERE id = crisis_ticket_id;
    
    -- Buscar tickets similares e agrupá-los
    FOR v_ticket_record IN
        SELECT t.id, t.codigo_ticket, t.descricao_problema
        FROM tickets t
        WHERE t.data_abertura >= NOW() - INTERVAL '2 hours'
        AND t.status != 'concluido'
        AND t.prioridade IN ('imediato', 'crise')
        AND LOWER(t.descricao_problema) LIKE '%' || primary_keyword || '%'
        AND t.id != crisis_ticket_id
    LOOP
        -- Atualizar ticket para crise
        UPDATE tickets 
        SET prioridade = 'crise'::ticket_prioridade,
            status = 'escalonado'::ticket_status,
            escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0), 5)
        WHERE id = v_ticket_record.id;
        
        similar_count := similar_count + 1;
        
        RAISE NOTICE 'Ticket % agrupado na crise', v_ticket_record.codigo_ticket;
    END LOOP;
    
    RETURN similar_count + 1; -- +1 para incluir o ticket base
END;
$function$;