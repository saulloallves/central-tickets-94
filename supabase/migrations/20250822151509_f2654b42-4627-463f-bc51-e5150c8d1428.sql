-- Atualizar função de detecção de crise para ser mais eficaz
CREATE OR REPLACE FUNCTION public.detect_and_activate_crisis_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    similar_tickets_count INTEGER;
    primary_keyword TEXT;
    crisis_id UUID;
    crisis_keywords TEXT[] := ARRAY['girabot', 'sistema', 'travou', 'caiu', 'não funciona', 'nao funciona', 'erro', 'falhou'];
BEGIN
    -- Só processar tickets com prioridade imediato ou mais alta
    IF NEW.prioridade NOT IN ('imediato', 'crise') THEN
        RETURN NEW;
    END IF;
    
    -- Extrair palavra-chave principal da descrição
    primary_keyword := LOWER(TRIM(SPLIT_PART(NEW.descricao_problema, ' ', 1)));
    
    -- Contar tickets similares nas últimas 30 minutos
    SELECT COUNT(*) INTO similar_tickets_count
    FROM tickets t
    WHERE t.data_abertura >= NOW() - INTERVAL '30 minutes'
    AND t.status != 'concluido'
    AND t.prioridade IN ('imediato', 'crise')
    AND (
        -- Mesmo problema específico (palavra-chave similar)
        LOWER(t.descricao_problema) LIKE '%' || primary_keyword || '%'
        OR
        -- Mesma categoria sistema com qualquer palavra-chave crítica
        (t.categoria = 'sistema' AND NEW.categoria = 'sistema' AND 
         (LOWER(t.descricao_problema) LIKE ANY(SELECT '%' || unnest(crisis_keywords) || '%')))
    );
    
    -- Debug log
    RAISE NOTICE 'Keyword: %, Similar tickets in 30min: %', primary_keyword, similar_tickets_count;
    
    -- Se há 3 ou mais tickets similares, criar/ativar crise
    IF similar_tickets_count >= 3 THEN
        -- Verificar se já existe crise ativa similar
        SELECT ca.id INTO crisis_id
        FROM crises_ativas ca
        JOIN tickets ct ON ct.id = ca.ticket_id
        WHERE ca.resolvida_em IS NULL
        AND ca.criada_em >= NOW() - INTERVAL '1 hour'
        AND (
            LOWER(ct.descricao_problema) LIKE '%' || primary_keyword || '%'
            OR (ct.categoria = 'sistema' AND NEW.categoria = 'sistema')
        )
        ORDER BY ca.criada_em DESC
        LIMIT 1;
        
        -- Se não existe crise ativa, criar uma nova
        IF crisis_id IS NULL THEN
            crisis_id := public.activate_crisis(
                NEW.id, 
                'Crise automática detectada: ' || similar_tickets_count || ' tickets similares sobre "' || primary_keyword || '"',
                NEW.criado_por,
                ARRAY[NEW.unidade_id]
            );
            
            RAISE NOTICE 'Crise criada automaticamente: % para ticket %', crisis_id, NEW.codigo_ticket;
        ELSE
            -- Atualizar crise existente
            UPDATE crises_ativas 
            SET log_acoes = log_acoes || jsonb_build_object(
                'acao', 'ticket_similar_adicionado',
                'ticket_id', NEW.id,
                'codigo_ticket', NEW.codigo_ticket,
                'timestamp', NOW()
            )
            WHERE id = crisis_id;
            
            RAISE NOTICE 'Ticket % adicionado à crise existente %', NEW.codigo_ticket, crisis_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS detect_and_group_crise_trigger ON tickets;
DROP TRIGGER IF EXISTS check_and_activate_crisis_trigger ON tickets;

-- Criar novo trigger mais eficiente
CREATE TRIGGER detect_crisis_v2_trigger
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION detect_and_activate_crisis_v2();

-- Função para processar tickets existentes e criar crise manualmente
CREATE OR REPLACE FUNCTION public.process_existing_girabot_crisis()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    crisis_id UUID;
    ticket_count INTEGER;
BEGIN
    -- Contar tickets do girabot das últimas 2 horas
    SELECT COUNT(*) INTO ticket_count
    FROM tickets t
    WHERE t.data_abertura >= NOW() - INTERVAL '2 hours'
    AND LOWER(t.descricao_problema) LIKE '%girabot%'
    AND t.status != 'concluido';
    
    -- Se há tickets suficientes, criar crise
    IF ticket_count >= 3 THEN
        -- Pegar o primeiro ticket para base da crise
        SELECT t.id INTO crisis_id
        FROM tickets t
        WHERE t.data_abertura >= NOW() - INTERVAL '2 hours'
        AND LOWER(t.descricao_problema) LIKE '%girabot%'
        AND t.status != 'concluido'
        ORDER BY t.data_abertura ASC
        LIMIT 1;
        
        -- Ativar crise
        crisis_id := public.activate_crisis(
            crisis_id,
            'Crise detectada: ' || ticket_count || ' tickets sobre problemas no girabot',
            auth.uid(),
            ARRAY['a9af7dfc-c210-4a52-bb60-065c5dc1f40e']
        );
        
        RETURN crisis_id;
    END IF;
    
    RETURN NULL;
END;
$function$;