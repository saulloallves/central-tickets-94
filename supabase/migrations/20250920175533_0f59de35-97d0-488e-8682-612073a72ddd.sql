-- Remover triggers que dependem da coluna prioridade
DROP TRIGGER IF EXISTS detect_crise_trigger ON tickets;
DROP TRIGGER IF EXISTS auto_link_crisis_trigger ON tickets;

-- Primeiro remover valores padrão que podem conflitar
ALTER TABLE tickets ALTER COLUMN prioridade DROP DEFAULT;

-- Renomear enum atual
ALTER TYPE ticket_prioridade RENAME TO ticket_prioridade_old;

-- Criar novo enum
CREATE TYPE ticket_prioridade AS ENUM ('baixo', 'medio', 'alto', 'imediato', 'crise');

-- Atualizar coluna com mapeamento
ALTER TABLE tickets 
ALTER COLUMN prioridade TYPE ticket_prioridade 
USING CASE 
  WHEN prioridade::text = 'posso_esperar' THEN 'baixo'::ticket_prioridade
  WHEN prioridade::text = 'ainda_hoje' THEN 'medio'::ticket_prioridade  
  WHEN prioridade::text = 'ate_1_hora' THEN 'alto'::ticket_prioridade
  WHEN prioridade::text = 'imediato' THEN 'imediato'::ticket_prioridade
  WHEN prioridade::text = 'crise' THEN 'crise'::ticket_prioridade
  ELSE 'medio'::ticket_prioridade
END;

-- Definir novo valor padrão
ALTER TABLE tickets ALTER COLUMN prioridade SET DEFAULT 'medio'::ticket_prioridade;

-- Recriar trigger detect_crise_trigger com novas prioridades
CREATE OR REPLACE FUNCTION public.detect_and_group_crise()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
$function$;

-- Recriar trigger auto_link_crisis_trigger com novas prioridades  
CREATE OR REPLACE FUNCTION public.auto_link_ticket_to_crisis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  matched_crisis_id UUID;
  keyword TEXT;
  crisis_keywords TEXT[];
BEGIN
  -- Only process tickets with crisis priority or specific keywords
  IF NEW.prioridade = 'crise' OR 
     NEW.descricao_problema ILIKE ANY(ARRAY['%sistema caiu%', '%travou%', '%não funciona%', '%nao funciona%', '%fora do ar%', '%indisponivel%', '%indisponível%']) THEN
    
    -- Look for active crises created in the last 2 hours
    FOR matched_crisis_id, crisis_keywords IN
      SELECT c.id, c.palavras_chave
      FROM crises c
      WHERE c.status IN ('aberto', 'investigando', 'comunicado', 'mitigado', 'reaberto')
        AND c.created_at > NOW() - INTERVAL '2 hours'
      ORDER BY c.created_at DESC
    LOOP
      -- Check if any crisis keyword matches the ticket description
      IF crisis_keywords IS NOT NULL THEN
        FOREACH keyword IN ARRAY crisis_keywords LOOP
          IF NEW.descricao_problema ILIKE '%' || keyword || '%' THEN
            -- Link the ticket to this crisis
            INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
            VALUES (matched_crisis_id, NEW.id, NEW.criado_por)
            ON CONFLICT (crise_id, ticket_id) DO NOTHING;
            
            -- Update ticket priority to crisis if not already
            IF NEW.prioridade != 'crise' THEN
              UPDATE public.tickets 
              SET prioridade = 'crise'::ticket_prioridade,
                  escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel, 0), 5)
              WHERE id = NEW.id;
            END IF;
            
            -- Add update to crisis
            INSERT INTO public.crise_updates (crise_id, tipo, mensagem, created_by)
            VALUES (matched_crisis_id, 'ticket_added', 
                   'Ticket ' || NEW.codigo_ticket || ' vinculado automaticamente', 
                   NEW.criado_por);
            
            -- Log the auto-linking
            PERFORM public.log_system_action(
              'sistema'::public.log_tipo,
              'crise_ticket_links',
              matched_crisis_id::TEXT,
              'Auto-vinculação de ticket baseado em palavra-chave: ' || keyword,
              NEW.criado_por,
              NULL, NULL, NULL, NULL,
              jsonb_build_object('ticket_id', NEW.id, 'keyword', keyword),
              'painel_interno'::public.log_canal
            );
            
            RETURN NEW; -- Exit after first match
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recriar os triggers
CREATE TRIGGER detect_crise_trigger
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION detect_and_group_crise();

CREATE TRIGGER auto_link_crisis_trigger
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_ticket_to_crisis();

-- Remover enum antigo
DROP TYPE ticket_prioridade_old;