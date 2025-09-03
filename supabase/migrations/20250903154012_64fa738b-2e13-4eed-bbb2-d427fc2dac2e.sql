-- Corrigir problema de array malformed na função detect_and_group_crise_improved

CREATE OR REPLACE FUNCTION public.detect_and_group_crise_improved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    ticket_record RECORD;
    crise_record RECORD;
    problem_keywords TEXT[] := ARRAY[]::TEXT[];
    matched_crisis_id UUID;
    linked_tickets_count INTEGER;
    unidades_afetadas TEXT[];
    keyword_overlap INTEGER;
    max_overlap INTEGER := 0;
    best_crisis_id UUID;
BEGIN
    -- Get the ticket information
    SELECT * INTO ticket_record 
    FROM tickets 
    WHERE id = NEW.id;
    
    -- Only process tickets with crisis priority
    IF ticket_record.prioridade != 'crise' THEN
        RETURN NEW;
    END IF;
    
    -- Extract meaningful keywords from problem description
    -- Normalize common variations and extract system-related keywords
    
    -- Normalize common system problem keywords
    IF ticket_record.descricao_problema ILIKE ANY(ARRAY['%caindo%', '%caiu%', '%queda%', '%parou%', '%travou%', '%instabil%']) THEN
        problem_keywords := problem_keywords || ARRAY['sistema_instavel'];
    END IF;
    
    IF ticket_record.descricao_problema ILIKE ANY(ARRAY['%lento%', '%lentidao%', '%demora%', '%devagar%']) THEN
        problem_keywords := problem_keywords || ARRAY['sistema_lento'];
    END IF;
    
    IF ticket_record.descricao_problema ILIKE ANY(ARRAY['%sistema%', '%girabot%', '%plataforma%']) THEN
        problem_keywords := problem_keywords || ARRAY['sistema_geral'];
    END IF;
    
    IF ticket_record.descricao_problema ILIKE ANY(ARRAY['%erro%', '%falha%', '%problema%', '%bug%']) THEN
        problem_keywords := problem_keywords || ARRAY['erro_sistema'];
    END IF;
    
    -- Se não encontrou keywords específicas, usar palavras relevantes da descrição
    IF array_length(problem_keywords, 1) IS NULL THEN
        WITH words_extracted AS (
            SELECT unnest(string_to_array(
                regexp_replace(LOWER(ticket_record.descricao_problema), '[^a-záêçõ\s]', '', 'g'), 
                ' '
            )) AS word
        )
        SELECT array_agg(DISTINCT word) INTO problem_keywords
        FROM words_extracted
        WHERE length(word) >= 4 -- Palavras com pelo menos 4 caracteres
        AND word NOT IN ('para', 'como', 'onde', 'quando', 'porque', 'aqui', 'esta', 'esse', 'essa', 'isso')
        AND word IS NOT NULL
        AND trim(word) != '';
        
        -- Garantir que sempre temos um array válido e limitar a 3 palavras
        IF problem_keywords IS NULL THEN
            problem_keywords := ARRAY['problema_geral'];
        ELSE
            problem_keywords := problem_keywords[1:3];
        END IF;
    END IF;
    
    -- Look for existing active crisis with overlapping keywords
    FOR crise_record IN 
        SELECT c.* 
        FROM crises c
        WHERE c.status IN ('aberto', 'investigando', 'comunicado', 'mitigado')
        AND c.created_at > NOW() - INTERVAL '2 hours'  -- Janela de 2 horas
        ORDER BY c.created_at DESC
    LOOP
        -- Calculate keyword overlap
        SELECT COUNT(*) INTO keyword_overlap
        FROM unnest(problem_keywords) pk
        WHERE pk = ANY(crise_record.palavras_chave);
        
        -- If we have significant overlap, consider this crisis a match
        IF keyword_overlap > max_overlap THEN
            max_overlap := keyword_overlap;
            best_crisis_id := crise_record.id;
        END IF;
    END LOOP;
    
    -- If we found a good match (at least 1 keyword overlap), use existing crisis
    IF max_overlap >= 1 THEN
        matched_crisis_id := best_crisis_id;
        
        -- Link to existing crisis
        INSERT INTO crise_ticket_links (
            crise_id,
            ticket_id,
            linked_by
        ) VALUES (
            matched_crisis_id,
            ticket_record.id,
            ticket_record.criado_por
        ) ON CONFLICT (crise_id, ticket_id) DO NOTHING;
        
        -- Update keywords to include new ones (safely)
        UPDATE crises 
        SET palavras_chave = (
            SELECT array_agg(DISTINCT kw) 
            FROM (
                SELECT unnest(palavras_chave) AS kw
                UNION 
                SELECT unnest(problem_keywords) AS kw
            ) combined_keywords
            WHERE kw IS NOT NULL
        ),
        ultima_atualizacao = now()
        WHERE id = matched_crisis_id;
        
        -- Add update to existing crisis
        INSERT INTO crise_updates (
            crise_id,
            tipo,
            mensagem,
            created_by
        ) VALUES (
            matched_crisis_id,
            'ticket_added',
            'Ticket ' || ticket_record.codigo_ticket || ' adicionado à crise existente',
            ticket_record.criado_por
        );
        
    ELSE
        -- Create a new crisis only if no match found
        INSERT INTO crises (
            titulo,
            descricao,
            palavras_chave,
            status,
            abriu_por
        ) VALUES (
            'Crise automática: ' || array_to_string(problem_keywords, ', '),
            'Crise detectada automaticamente devido a múltiplos tickets com problema: ' || ticket_record.descricao_problema,
            problem_keywords,
            'aberto',
            ticket_record.criado_por
        ) RETURNING id INTO matched_crisis_id;
        
        -- Log the crisis creation
        INSERT INTO crise_updates (
            crise_id,
            tipo,
            status,
            mensagem,
            created_by
        ) VALUES (
            matched_crisis_id,
            'status_change',
            'aberto',
            'Crise criada automaticamente - Problema detectado: ' || ticket_record.descricao_problema,
            ticket_record.criado_por
        );
        
        -- Auto-link similar tickets
        SELECT public.auto_link_similar_tickets_to_crisis(
            matched_crisis_id, 
            problem_keywords,
            120 -- 2 horas de janela
        ) INTO linked_tickets_count;
        
        -- Coletar unidades afetadas
        SELECT array_agg(DISTINCT t.unidade_id) INTO unidades_afetadas
        FROM crise_ticket_links ctl
        JOIN tickets t ON ctl.ticket_id = t.id
        WHERE ctl.crise_id = matched_crisis_id;
        
        -- Atualizar descrição com informações sobre unidades afetadas
        IF unidades_afetadas IS NOT NULL AND array_length(unidades_afetadas, 1) > 0 THEN
            UPDATE crises 
            SET descricao = descricao || format(' | Unidades afetadas: %s', array_length(unidades_afetadas, 1))
            WHERE id = matched_crisis_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;