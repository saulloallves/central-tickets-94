-- Criar função para unlink ticket from crisis (que está sendo chamada mas não existe)
CREATE OR REPLACE FUNCTION public.unlink_ticket_from_crisis(
  p_crise_id UUID,
  p_ticket_id UUID,
  p_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove o link entre ticket e crise
  DELETE FROM public.crise_ticket_links 
  WHERE crise_id = p_crise_id AND ticket_id = p_ticket_id;
  
  -- Volta prioridade do ticket para imediato se não estiver vinculado a outras crises
  IF NOT EXISTS (
    SELECT 1 FROM public.crise_ticket_links 
    WHERE ticket_id = p_ticket_id
  ) THEN
    UPDATE public.tickets 
    SET prioridade = 'imediato'::ticket_prioridade,
        escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0) - 1, 0)
    WHERE id = p_ticket_id;
  END IF;
  
  -- Adiciona update na crise
  INSERT INTO public.crise_updates (crise_id, tipo, mensagem, created_by)
  VALUES (p_crise_id, 'ticket_removed', 'Ticket desvinculado da crise', COALESCE(p_by, auth.uid()));
  
  -- Log da ação
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'crise_ticket_links',
    p_crise_id::TEXT,
    'Ticket desvinculado da crise',
    COALESCE(p_by, auth.uid()),
    NULL, NULL, NULL, NULL,
    jsonb_build_object('ticket_id', p_ticket_id),
    'painel_interno'::public.log_canal
  );
END;
$function$;

-- Criar função para vincular tickets similares automaticamente após criação da crise
CREATE OR REPLACE FUNCTION public.auto_link_similar_tickets_to_crisis(
  p_crise_id UUID,
  p_palavras_chave TEXT[] DEFAULT NULL,
  p_time_window_minutes INTEGER DEFAULT 120
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_record RECORD;
  v_linked_count INTEGER := 0;
  v_keyword TEXT;
  v_similar_criteria TEXT;
BEGIN
  -- Se não há palavras-chave, usar critério básico por categoria "sistema"
  IF p_palavras_chave IS NULL OR array_length(p_palavras_chave, 1) = 0 THEN
    p_palavras_chave := ARRAY['sistema'];
  END IF;
  
  -- Buscar tickets similares nas últimas horas que não estão vinculados a crises
  FOR v_ticket_record IN
    SELECT DISTINCT t.id, t.codigo_ticket, t.descricao_problema, t.unidade_id, t.categoria
    FROM tickets t
    LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
    WHERE ctl.crise_id IS NULL -- Não vinculado a nenhuma crise
      AND t.data_abertura >= now() - interval '1 minute' * p_time_window_minutes
      AND t.status IN ('aberto', 'em_atendimento', 'escalonado')
      AND (
        -- Verifica se contém qualquer palavra-chave na descrição
        EXISTS (
          SELECT 1 FROM unnest(p_palavras_chave) AS keyword 
          WHERE t.descricao_problema ILIKE '%' || keyword || '%'
        )
        OR 
        -- Ou se tem a mesma categoria de sistema
        (t.categoria = 'sistema' AND 'sistema' = ANY(p_palavras_chave))
        OR
        -- Ou se tem prioridade crise/imediato (indicativo de problema grave)
        t.prioridade IN ('crise', 'imediato')
      )
    ORDER BY t.data_abertura DESC
  LOOP
    -- Vincular ticket à crise
    INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
    VALUES (p_crise_id, v_ticket_record.id, auth.uid())
    ON CONFLICT (crise_id, ticket_id) DO NOTHING;
    
    -- Se inserção foi bem-sucedida, incrementar contador
    IF FOUND THEN
      v_linked_count := v_linked_count + 1;
      
      -- Atualizar prioridade do ticket para crise
      UPDATE public.tickets
      SET prioridade = 'crise'::ticket_prioridade,
          escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0), 5)
      WHERE id = v_ticket_record.id 
        AND prioridade IS DISTINCT FROM 'crise'::ticket_prioridade;
      
      -- Notificação para o ticket
      INSERT INTO public.notifications_queue (ticket_id, type, payload)
      VALUES (v_ticket_record.id, 'crisis', jsonb_build_object('crise_id', p_crise_id))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  -- Se vinculou tickets, adicionar update na crise
  IF v_linked_count > 0 THEN
    INSERT INTO public.crise_updates (crise_id, tipo, mensagem, created_by)
    VALUES (
      p_crise_id, 
      'auto_link', 
      format('Vinculação automática: %s tickets similares encontrados e vinculados', v_linked_count),
      auth.uid()
    );
    
    -- Atualizar descrição da crise com número de tickets
    UPDATE public.crises
    SET descricao = COALESCE(descricao, '') || format(' [Auto-vinculação: %s tickets]', v_linked_count),
        updated_at = now(),
        ultima_atualizacao = now()
    WHERE id = p_crise_id;
  END IF;
  
  RETURN v_linked_count;
END;
$function$;

-- Modificar o trigger de detecção de crise para chamar a função de auto-vinculação
CREATE OR REPLACE FUNCTION public.detect_and_group_crise_improved()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    ticket_record RECORD;
    crise_record RECORD;
    primary_keyword TEXT;
    matched_crisis_id UUID;
    linked_tickets_count INTEGER;
    unidades_afetadas TEXT[];
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
        AND c.created_at > NOW() - INTERVAL '2 hours'
        ORDER BY c.created_at DESC
    LOOP
        -- Check if the primary keyword matches crisis keywords
        IF crise_record.palavras_chave IS NOT NULL AND 
           primary_keyword = ANY(crise_record.palavras_chave) THEN
            matched_crisis_id := crise_record.id;
            EXIT;
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
        
        -- Auto-link similar tickets (key improvement)
        SELECT public.auto_link_similar_tickets_to_crisis(
            matched_crisis_id, 
            ARRAY[primary_keyword],
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
    ELSE
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
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Substituir o trigger atual
DROP TRIGGER IF EXISTS trigger_detect_and_group_crise ON tickets;
CREATE TRIGGER trigger_detect_and_group_crise_improved
    AFTER INSERT OR UPDATE OF prioridade ON tickets
    FOR EACH ROW
    WHEN (NEW.prioridade = 'crise')
    EXECUTE FUNCTION detect_and_group_crise_improved();