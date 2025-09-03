-- Fix SELECT DISTINCT with ORDER BY issue in auto_link_similar_tickets_to_crisis function
CREATE OR REPLACE FUNCTION public.auto_link_similar_tickets_to_crisis(p_crise_id uuid, p_palavras_chave text[] DEFAULT NULL::text[], p_time_window_minutes integer DEFAULT 60)
 RETURNS integer
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
  -- FIXED: Include data_abertura in SELECT list to match ORDER BY
  FOR v_ticket_record IN
    SELECT DISTINCT t.id, t.codigo_ticket, t.descricao_problema, t.unidade_id, t.categoria, t.data_abertura
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
$function$