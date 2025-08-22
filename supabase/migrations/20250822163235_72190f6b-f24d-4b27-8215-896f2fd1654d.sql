-- Melhorar detecção automática para qualquer tipo de problema com 3+ tickets similares
CREATE OR REPLACE FUNCTION public.detect_and_group_enhanced_crise()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    ticket_record RECORD;
    crise_record RECORD;
    primary_keyword TEXT;
    matched_crisis_id UUID;
    similar_tickets_count INTEGER;
    existing_tickets_ids UUID[];
    problem_words TEXT[];
    significant_word TEXT;
    word_counts RECORD;
BEGIN
    -- Get the ticket information
    SELECT * INTO ticket_record 
    FROM tickets 
    WHERE id = NEW.id;
    
    -- Only process tickets with crisis priority that are not concluded
    IF ticket_record.prioridade != 'crise' OR ticket_record.status = 'concluido' THEN
        RETURN NEW;
    END IF;
    
    -- Extract significant words from problem description
    problem_words := string_to_array(LOWER(TRIM(ticket_record.descricao_problema)), ' ');
    
    -- Find the most significant word (skip common words, min 3 chars)
    FOR i IN 1..LEAST(array_length(problem_words, 1), 5) LOOP
        significant_word := problem_words[i];
        -- Skip common words and very short words
        IF significant_word NOT IN ('o', 'a', 'e', 'de', 'do', 'da', 'em', 'na', 'no', 'nao', 'não', 'esta', 'está', 'com', 'para', 'por', 'que', 'um', 'uma', 'os', 'as', 'dos', 'das', 'tem', 'ter') 
           AND length(significant_word) >= 3 THEN
            primary_keyword := significant_word;
            EXIT;
        END IF;
    END LOOP;
    
    -- If no significant word found, use first meaningful word
    IF primary_keyword IS NULL THEN
        FOR i IN 1..array_length(problem_words, 1) LOOP
            IF length(problem_words[i]) >= 3 THEN
                primary_keyword := problem_words[i];
                EXIT;
            END IF;
        END LOOP;
    END IF;
    
    -- If still no keyword, use first word
    IF primary_keyword IS NULL AND array_length(problem_words, 1) > 0 THEN
        primary_keyword := problem_words[1];
    END IF;
    
    -- Look for existing active crisis with similar problem
    FOR crise_record IN 
        SELECT c.* 
        FROM crises c
        WHERE c.status IN ('aberto', 'investigando', 'comunicado', 'mitigado')
        AND c.created_at > NOW() - INTERVAL '4 hours'  -- Only recent crises
        ORDER BY c.created_at DESC
    LOOP
        -- Check if the primary keyword matches crisis keywords
        IF crise_record.palavras_chave IS NOT NULL AND 
           primary_keyword = ANY(crise_record.palavras_chave) THEN
            
            matched_crisis_id := crise_record.id;
            EXIT;
        END IF;
    END LOOP;
    
    -- Count similar tickets in the last 2 hours
    -- Use ILIKE for partial matching and similarity for better detection
    SELECT COUNT(*) INTO similar_tickets_count
    FROM tickets t
    WHERE t.prioridade = 'crise'
    AND t.status IN ('escalonado', 'em_atendimento', 'aberto') -- Include all active statuses
    AND t.data_abertura >= NOW() - INTERVAL '2 hours'
    AND (
        t.descricao_problema ILIKE '%' || primary_keyword || '%'
        OR similarity(LOWER(t.descricao_problema), LOWER(ticket_record.descricao_problema)) > 0.3
    )
    AND t.id != ticket_record.id;
    
    -- Alternative approach: check for word frequency patterns
    IF similar_tickets_count < 2 THEN
        -- Look for tickets with any common significant words
        SELECT COUNT(*) INTO similar_tickets_count
        FROM tickets t
        WHERE t.prioridade = 'crise'
        AND t.status IN ('escalonado', 'em_atendimento', 'aberto')
        AND t.data_abertura >= NOW() - INTERVAL '2 hours'
        AND EXISTS (
            SELECT 1 FROM unnest(string_to_array(LOWER(t.descricao_problema), ' ')) AS word
            WHERE word = ANY(problem_words) 
            AND length(word) >= 4
            AND word NOT IN ('sistema', 'problema', 'cliente', 'usuario', 'funciona', 'consegue')
        )
        AND t.id != ticket_record.id;
    END IF;
    
    -- If we have 2 or more similar tickets (total of 3 including current), create/link to crisis
    IF similar_tickets_count >= 2 THEN
        -- If no similar crisis found, create a new one
        IF matched_crisis_id IS NULL THEN
            -- Create a new crisis for this specific problem type
            INSERT INTO crises (
                titulo,
                descricao,
                palavras_chave,
                status,
                abriu_por
            ) VALUES (
                'Crise automática: ' || COALESCE(primary_keyword, 'Múltiplos problemas'),
                'Crise detectada automaticamente devido a ' || (similar_tickets_count + 1) || ' tickets similares',
                ARRAY[COALESCE(primary_keyword, 'problema')],
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
                'Crise criada automaticamente - ' || (similar_tickets_count + 1) || ' tickets detectados com problema: ' || ticket_record.descricao_problema,
                ticket_record.criado_por
            );
        END IF;
        
        -- Link the new ticket to the crisis
        INSERT INTO crise_ticket_links (
            crise_id,
            ticket_id,
            linked_by
        ) VALUES (
            matched_crisis_id,
            ticket_record.id,
            ticket_record.criado_por
        ) ON CONFLICT (crise_id, ticket_id) DO NOTHING;
        
        -- Find and link ALL similar tickets that aren't linked yet
        SELECT ARRAY_AGG(t.id) INTO existing_tickets_ids
        FROM tickets t
        LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id AND ctl.crise_id = matched_crisis_id
        WHERE t.prioridade = 'crise'
        AND t.status IN ('escalonado', 'em_atendimento', 'aberto')
        AND t.data_abertura >= NOW() - INTERVAL '4 hours'
        AND (
            t.descricao_problema ILIKE '%' || primary_keyword || '%'
            OR similarity(LOWER(t.descricao_problema), LOWER(ticket_record.descricao_problema)) > 0.3
            OR EXISTS (
                SELECT 1 FROM unnest(string_to_array(LOWER(t.descricao_problema), ' ')) AS word
                WHERE word = ANY(problem_words) 
                AND length(word) >= 4
            )
        )
        AND ctl.ticket_id IS NULL
        AND t.id != ticket_record.id;
        
        -- Link all similar tickets to the crisis
        IF existing_tickets_ids IS NOT NULL AND array_length(existing_tickets_ids, 1) > 0 THEN
            INSERT INTO crise_ticket_links (crise_id, ticket_id, linked_by)
            SELECT matched_crisis_id, unnest(existing_tickets_ids), ticket_record.criado_por
            ON CONFLICT (crise_id, ticket_id) DO NOTHING;
        END IF;
        
        -- Count total tickets now linked
        SELECT COUNT(*) INTO similar_tickets_count
        FROM crise_ticket_links ctl 
        JOIN tickets t ON ctl.ticket_id = t.id
        WHERE ctl.crise_id = matched_crisis_id
        AND t.status IN ('escalonado', 'em_atendimento', 'aberto');
        
        -- Add update to crisis
        INSERT INTO crise_updates (
            crise_id,
            tipo,
            mensagem,
            created_by
        ) VALUES (
            matched_crisis_id,
            'ticket_added',
            'Crise agrupou ' || similar_tickets_count || ' tickets similares',
            ticket_record.criado_por
        );
        
        -- Update crisis description with current count
        UPDATE crises 
        SET descricao = 'Crise automática com ' || similar_tickets_count || ' tickets similares detectados',
            updated_at = NOW()
        WHERE id = matched_crisis_id;
        
        -- Log para debug
        RAISE NOTICE 'CRISE DETECTADA: % tickets similares agrupados. Palavra-chave: %', similar_tickets_count, primary_keyword;
    END IF;
    
    RETURN NEW;
END;
$function$;