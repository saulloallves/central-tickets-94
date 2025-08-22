-- Melhorar a lógica de detecção e agrupamento de crises
-- Separar problemas diferentes em crises diferentes

CREATE OR REPLACE FUNCTION detect_and_group_crise()
RETURNS TRIGGER AS $$
DECLARE
    ticket_record RECORD;
    crise_record RECORD;
    primary_keyword TEXT;
    matched_crisis_id UUID;
    matched_by_similarity BOOLEAN := FALSE;
BEGIN
    -- Get the ticket information
    SELECT * INTO ticket_record 
    FROM tickets 
    WHERE id = NEW.id;
    
    -- Only process tickets with crisis priority
    IF ticket_record.prioridade != 'crise' THEN
        RETURN NEW;
    END IF;
    
    -- Extract primary keyword from problem description (first significant word)
    primary_keyword := LOWER(TRIM(SPLIT_PART(ticket_record.descricao_problema, ' ', 1)));
    
    -- Look for existing active crisis with similar problem (stricter matching)
    FOR crise_record IN 
        SELECT c.* 
        FROM crises c
        WHERE c.status IN ('aberto', 'investigando', 'comunicado', 'mitigado')
        AND c.created_at > NOW() - INTERVAL '2 hours'  -- Only recent crises
        ORDER BY c.created_at DESC
    LOOP
        -- Check if the primary keyword matches crisis keywords
        IF crise_record.palavras_chave IS NOT NULL AND 
           primary_keyword = ANY(crise_record.palavras_chave) THEN
            
            -- Additional check: look at existing tickets in this crisis
            -- to see if they have similar problems
            IF EXISTS (
                SELECT 1 
                FROM crise_ticket_links ctl
                JOIN tickets t ON ctl.ticket_id = t.id
                WHERE ctl.crise_id = crise_record.id
                AND similarity(LOWER(t.descricao_problema), LOWER(ticket_record.descricao_problema)) > 0.6
            ) THEN
                matched_crisis_id := crise_record.id;
                matched_by_similarity := TRUE;
                EXIT;
            END IF;
        END IF;
    END LOOP;
    
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
            'Crise automática: ' || primary_keyword,
            'Crise detectada automaticamente devido a múltiplos tickets com problema: ' || ticket_record.descricao_problema,
            ARRAY[primary_keyword],
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
    END IF;
    
    -- Link the ticket to the crisis (if not already linked)
    IF NOT EXISTS (
        SELECT 1 FROM crise_ticket_links 
        WHERE ticket_id = ticket_record.id AND crise_id = matched_crisis_id
    ) THEN
        INSERT INTO crise_ticket_links (
            crise_id,
            ticket_id,
            linked_by
        ) VALUES (
            matched_crisis_id,
            ticket_record.id,
            ticket_record.criado_por
        );
        
        -- Add update to crisis
        INSERT INTO crise_updates (
            crise_id,
            tipo,
            mensagem,
            created_by
        ) VALUES (
            matched_crisis_id,
            'ticket_added',
            'Ticket ' || ticket_record.codigo_ticket || ' adicionado à crise',
            ticket_record.criado_por
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;