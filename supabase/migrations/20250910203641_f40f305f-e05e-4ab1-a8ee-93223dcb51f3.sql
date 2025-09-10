-- Criar função para detectar automaticamente grupos de tickets similares e criar crises
CREATE OR REPLACE FUNCTION public.auto_detect_crisis_by_similarity()
RETURNS TRIGGER AS $$
DECLARE
    similar_tickets_count INTEGER;
    similar_description TEXT;
    existing_crisis_id UUID;
    new_crisis_id UUID;
    ticket_ids UUID[];
BEGIN
    -- Só executar para tickets novos
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Verificar se há pelo menos 3 palavras na descrição para análise
    IF LENGTH(TRIM(NEW.descricao_problema)) < 10 THEN
        RETURN NEW;
    END IF;
    
    -- Normalizar descrição para busca
    similar_description := LOWER(TRIM(NEW.descricao_problema));
    
    -- Contar tickets similares nas últimas 2 horas (incluindo o atual)
    SELECT COUNT(*), ARRAY_AGG(id)
    INTO similar_tickets_count, ticket_ids
    FROM public.tickets t
    WHERE LOWER(TRIM(t.descricao_problema)) = similar_description
    AND t.created_at >= NOW() - INTERVAL '2 hours'
    AND t.status != 'concluido';
    
    -- Log para debug
    RAISE NOTICE 'Tickets similares encontrados: % para descrição: %', similar_tickets_count, LEFT(similar_description, 50);
    
    -- Se temos 5 ou mais tickets similares, verificar se já existe crise
    IF similar_tickets_count >= 5 THEN
        -- Verificar se já existe crise ativa para algum destes tickets
        SELECT c.id INTO existing_crisis_id
        FROM public.crises c
        JOIN public.crise_ticket_links ctl ON c.id = ctl.crise_id
        WHERE ctl.ticket_id = ANY(ticket_ids)
        AND c.status IN ('aberto', 'investigando', 'comunicado', 'mitigado')
        AND c.is_active = true
        LIMIT 1;
        
        -- Se não existe crise, criar uma
        IF existing_crisis_id IS NULL THEN
            RAISE NOTICE 'Criando nova crise para % tickets similares', similar_tickets_count;
            
            -- Criar nova crise
            INSERT INTO public.crises (
                titulo,
                descricao,
                status,
                equipe_id,
                abriu_por,
                palavras_chave,
                is_active
            ) VALUES (
                'Crise automática: ' || LEFT(NEW.titulo, 60),
                'Crise detectada automaticamente devido a ' || similar_tickets_count || ' tickets similares: ' || LEFT(similar_description, 200),
                'aberto',
                NEW.equipe_responsavel_id,
                NEW.criado_por,
                ARRAY['automatica', 'similar', LEFT(SPLIT_PART(similar_description, ' ', 1), 20)],
                true
            ) RETURNING id INTO new_crisis_id;
            
            -- Vincular todos os tickets similares à crise
            INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
            SELECT new_crisis_id, unnest(ticket_ids), NEW.criado_por
            ON CONFLICT (crise_id, ticket_id) DO NOTHING;
            
            -- Atualizar prioridade de todos os tickets para crise
            UPDATE public.tickets 
            SET prioridade = 'crise'::ticket_prioridade,
                escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel, 0), 5)
            WHERE id = ANY(ticket_ids);
            
            -- Log da criação
            INSERT INTO public.crise_updates (
                crise_id,
                tipo,
                status,
                mensagem,
                created_by
            ) VALUES (
                new_crisis_id,
                'status_change',
                'aberto',
                'Crise criada automaticamente - ' || similar_tickets_count || ' tickets similares detectados',
                NEW.criado_por
            );
            
            -- Atualizar contador de tickets na crise
            UPDATE public.crises 
            SET tickets_count = similar_tickets_count,
                ultima_atualizacao = NOW()
            WHERE id = new_crisis_id;
            
            RAISE NOTICE 'Crise criada: % com % tickets vinculados', new_crisis_id, similar_tickets_count;
            
        ELSE
            RAISE NOTICE 'Crise já existe: % - vinculando ticket atual', existing_crisis_id;
            
            -- Vincular apenas o ticket atual à crise existente
            INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
            VALUES (existing_crisis_id, NEW.id, NEW.criado_por)
            ON CONFLICT (crise_id, ticket_id) DO NOTHING;
            
            -- Atualizar prioridade do ticket atual
            UPDATE public.tickets 
            SET prioridade = 'crise'::ticket_prioridade,
                escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel, 0), 5)
            WHERE id = NEW.id;
            
            -- Atualizar contador da crise
            UPDATE public.crises 
            SET tickets_count = (
                SELECT COUNT(*) 
                FROM public.crise_ticket_links 
                WHERE crise_id = existing_crisis_id
            ),
            ultima_atualizacao = NOW()
            WHERE id = existing_crisis_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para detecção automática de crises por similaridade
DROP TRIGGER IF EXISTS auto_detect_crisis_similarity_trigger ON public.tickets;
CREATE TRIGGER auto_detect_crisis_similarity_trigger
    AFTER INSERT ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_detect_crisis_by_similarity();