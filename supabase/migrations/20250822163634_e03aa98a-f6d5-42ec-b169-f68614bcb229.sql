-- Corrigir detecção de crise para tickets "imediato" similares
CREATE OR REPLACE FUNCTION public.detect_crisis_on_similar_tickets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_crise_id UUID;
    v_ticket_record RECORD;
    v_similar_count INT;
    v_keyword TEXT;
    v_tickets_to_upgrade UUID[];
BEGIN
    -- Buscar grupos de tickets "imediato" similares nas últimas 2 horas
    FOR v_keyword IN
        SELECT DISTINCT 
            unnest(string_to_array(LOWER(TRIM(descricao_problema)), ' ')) as word
        FROM tickets 
        WHERE prioridade = 'imediato'
        AND status IN ('escalonado', 'em_atendimento', 'aberto')
        AND data_abertura >= NOW() - INTERVAL '2 hours'
        AND length(unnest(string_to_array(LOWER(TRIM(descricao_problema)), ' '))) >= 4
    LOOP
        -- Contar tickets similares com esta palavra-chave
        SELECT COUNT(*), ARRAY_AGG(id) INTO v_similar_count, v_tickets_to_upgrade
        FROM tickets 
        WHERE prioridade = 'imediato'
        AND status IN ('escalonado', 'em_atendimento', 'aberto')
        AND data_abertura >= NOW() - INTERVAL '2 hours'
        AND LOWER(descricao_problema) LIKE '%' || v_keyword || '%'
        AND NOT EXISTS (
            SELECT 1 FROM crise_ticket_links ctl WHERE ctl.ticket_id = tickets.id
        );
        
        -- Se há 3 ou mais tickets similares, criar crise
        IF v_similar_count >= 3 THEN
            -- Criar nova crise
            INSERT INTO public.crises (
                titulo,
                descricao,
                palavras_chave,
                status,
                abriu_por
            ) VALUES (
                'Crise automática: ' || v_keyword,
                'Crise detectada automaticamente - ' || v_similar_count || ' tickets imediatos similares',
                ARRAY[v_keyword],
                'aberto',
                (SELECT criado_por FROM tickets WHERE id = v_tickets_to_upgrade[1])
            ) RETURNING id INTO v_crise_id;
            
            -- Converter todos os tickets para prioridade "crise"
            UPDATE tickets 
            SET prioridade = 'crise'::ticket_prioridade
            WHERE id = ANY(v_tickets_to_upgrade);
            
            -- Vincular todos os tickets à crise
            INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
            SELECT v_crise_id, unnest(v_tickets_to_upgrade), (SELECT criado_por FROM tickets WHERE id = v_tickets_to_upgrade[1])
            ON CONFLICT (crise_id, ticket_id) DO NOTHING;
            
            -- Log da crise
            INSERT INTO public.crise_updates (
                crise_id,
                tipo,
                status,
                mensagem,
                created_by
            ) VALUES (
                v_crise_id,
                'status_change',
                'aberto',
                'Crise criada automaticamente - ' || v_similar_count || ' tickets imediatos sobre: ' || v_keyword,
                (SELECT criado_por FROM tickets WHERE id = v_tickets_to_upgrade[1])
            );
            
            RAISE NOTICE 'CRISE CRIADA: % tickets similares com palavra: %', v_similar_count, v_keyword;
            
            -- Sair do loop após criar uma crise
            EXIT;
        END IF;
    END LOOP;
END;
$function$;

-- Executar a função para verificar tickets existentes
SELECT detect_crisis_on_similar_tickets();

-- Também vamos criar um trigger para executar esta verificação automaticamente
CREATE OR REPLACE FUNCTION public.check_crisis_on_ticket_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Se é um ticket imediato novo ou atualizado, verificar se deve criar crise
    IF NEW.prioridade = 'imediato' AND NEW.status IN ('escalonado', 'em_atendimento', 'aberto') THEN
        PERFORM detect_crisis_on_similar_tickets();
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Aplicar o trigger
DROP TRIGGER IF EXISTS check_crisis_trigger ON tickets;
CREATE TRIGGER check_crisis_trigger
AFTER INSERT OR UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION check_crisis_on_ticket_change();