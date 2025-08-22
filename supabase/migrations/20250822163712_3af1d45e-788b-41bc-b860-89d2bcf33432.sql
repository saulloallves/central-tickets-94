-- Função simplificada para detectar e criar crise baseada em tickets "girabot"
CREATE OR REPLACE FUNCTION public.detect_girabot_crisis()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_crise_id UUID;
    v_similar_count INT;
    v_tickets_to_upgrade UUID[];
    v_result TEXT;
BEGIN
    -- Contar tickets "girabot" ativos não vinculados a crise
    SELECT COUNT(*), ARRAY_AGG(id) INTO v_similar_count, v_tickets_to_upgrade
    FROM tickets 
    WHERE prioridade = 'imediato'
    AND status IN ('escalonado', 'em_atendimento', 'aberto')
    AND data_abertura >= NOW() - INTERVAL '4 hours'
    AND LOWER(descricao_problema) LIKE '%girabot%'
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
            'Crise automática: Girabot',
            'Crise detectada automaticamente - ' || v_similar_count || ' tickets sobre girabot não funcionando',
            ARRAY['girabot'],
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
            'Crise criada automaticamente - ' || v_similar_count || ' tickets sobre girabot',
            (SELECT criado_por FROM tickets WHERE id = v_tickets_to_upgrade[1])
        );
        
        v_result := 'CRISE CRIADA! ID: ' || v_crise_id || ' - ' || v_similar_count || ' tickets vinculados';
    ELSE
        v_result := 'Apenas ' || v_similar_count || ' tickets encontrados (mínimo 3 necessário)';
    END IF;
    
    RETURN v_result;
END;
$function$;

-- Executar para verificar os tickets atuais
SELECT detect_girabot_crisis();

-- Trigger simplificado que será executado apenas para tickets com palavra "girabot"
CREATE OR REPLACE FUNCTION public.trigger_girabot_crisis_check()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verificar apenas se é ticket imediato com "girabot"
    IF NEW.prioridade = 'imediato' 
       AND NEW.status IN ('escalonado', 'em_atendimento', 'aberto') 
       AND LOWER(NEW.descricao_problema) LIKE '%girabot%' THEN
        
        PERFORM detect_girabot_crisis();
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Aplicar o trigger
DROP TRIGGER IF EXISTS girabot_crisis_trigger ON tickets;
CREATE TRIGGER girabot_crisis_trigger
AFTER INSERT OR UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION trigger_girabot_crisis_check();