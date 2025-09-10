-- ===== COMPREHENSIVE SYSTEM IMPROVEMENTS =====
-- Based on technical audit recommendations

-- 1. REMOVE OLD CRISIS TRIGGERS AND CLEAN UP LEGACY SYSTEM
DROP TRIGGER IF EXISTS check_and_activate_crisis_trigger ON public.tickets;
DROP FUNCTION IF EXISTS public.check_and_activate_crisis();
DROP FUNCTION IF EXISTS public.activate_crisis(uuid, text, uuid, text[]);
DROP FUNCTION IF EXISTS public.resolve_crisis(uuid, uuid);
DROP FUNCTION IF EXISTS public.log_crisis_action(uuid, text, uuid, jsonb);

-- 2. FIX RLS POLICIES
-- Fix internal_notification_recipients INSERT policy to be more secure
DROP POLICY IF EXISTS "System can insert notification recipients" ON public.internal_notification_recipients;
CREATE POLICY "Users can insert their own notification recipients" ON public.internal_notification_recipients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow system functions to insert notifications (for edge functions)
CREATE POLICY "System can insert notification recipients" ON public.internal_notification_recipients
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL OR auth.uid() = user_id
  );

-- 3. ENABLE REALTIME FOR CRITICAL TABLES
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.crise_ticket_links REPLICA IDENTITY FULL;
ALTER TABLE public.internal_notification_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.crises REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_mensagens REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crise_ticket_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notification_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crises;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_mensagens;

-- 4. PERFORMANCE INDICES
-- Critical indices for ticket filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridade ON public.tickets(prioridade);
CREATE INDEX IF NOT EXISTS idx_tickets_status_sla ON public.tickets(status_sla);
CREATE INDEX IF NOT EXISTS idx_tickets_unidade_id ON public.tickets(unidade_id);
CREATE INDEX IF NOT EXISTS idx_tickets_equipe_responsavel_id ON public.tickets(equipe_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tickets_data_abertura ON public.tickets(data_abertura);
CREATE INDEX IF NOT EXISTS idx_tickets_position ON public.tickets(position);

-- Composite indices for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_status_unidade ON public.tickets(status, unidade_id);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridade_status ON public.tickets(prioridade, status);
CREATE INDEX IF NOT EXISTS idx_tickets_equipe_status ON public.tickets(equipe_responsavel_id, status);

-- Text search index for ticket content
CREATE INDEX IF NOT EXISTS idx_tickets_search ON public.tickets USING gin(
  to_tsvector('portuguese', 
    COALESCE(titulo, '') || ' ' || 
    COALESCE(descricao_problema, '') || ' ' || 
    COALESCE(codigo_ticket, '')
  )
);

-- Crisis-related indices
CREATE INDEX IF NOT EXISTS idx_crises_status ON public.crises(status);
CREATE INDEX IF NOT EXISTS idx_crises_is_active ON public.crises(is_active);
CREATE INDEX IF NOT EXISTS idx_crise_ticket_links_crise_id ON public.crise_ticket_links(crise_id);
CREATE INDEX IF NOT EXISTS idx_crise_ticket_links_ticket_id ON public.crise_ticket_links(ticket_id);

-- Notification indices
CREATE INDEX IF NOT EXISTS idx_internal_notifications_equipe ON public.internal_notifications(equipe_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON public.internal_notification_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_read ON public.internal_notification_recipients(is_read);

-- 5. IMPROVE CRISIS DETECTION TRIGGER
CREATE OR REPLACE FUNCTION public.detect_and_group_crise_improved()
RETURNS TRIGGER AS $$
DECLARE
    ticket_record RECORD;
    crise_record RECORD;
    primary_keyword TEXT;
    matched_crisis_id UUID;
    keywords_critical TEXT[] := ARRAY[
        'sistema travou', 'sistema caiu', 'não consigo vender', 'nao consigo vender',
        'cliente xingando', 'reclamação grave', 'reclamacao grave', 'ação judicial',
        'acao judicial', 'urgência máxima', 'urgencia maxima', 'ameaça', 'advogado',
        'procon', 'trava total', 'sistema fora', 'sem acesso', 'parado total'
    ];
    keyword TEXT;
BEGIN
    -- Get the ticket information
    SELECT * INTO ticket_record 
    FROM tickets 
    WHERE id = NEW.id;
    
    -- Only process tickets with crisis priority OR critical keywords
    IF ticket_record.prioridade != 'crise' THEN
        -- Check for critical keywords in description
        IF ticket_record.descricao_problema IS NOT NULL THEN
            FOREACH keyword IN ARRAY keywords_critical LOOP
                IF LOWER(ticket_record.descricao_problema) LIKE '%' || keyword || '%' THEN
                    -- Auto-escalate to crisis priority
                    UPDATE public.tickets 
                    SET prioridade = 'crise'::ticket_prioridade,
                        escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0), 5)
                    WHERE id = NEW.id;
                    
                    -- Update our local record
                    ticket_record.prioridade := 'crise';
                    EXIT;
                END IF;
            END LOOP;
        END IF;
        
        -- If still not crisis priority, exit
        IF ticket_record.prioridade != 'crise' THEN
            RETURN NEW;
        END IF;
    END IF;
    
    -- Extract primary keyword from problem description
    primary_keyword := LOWER(TRIM(SPLIT_PART(COALESCE(ticket_record.descricao_problema, ''), ' ', 1)));
    
    -- Look for existing active crisis with similar problem
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
            
            -- Additional similarity check with existing tickets
            IF EXISTS (
                SELECT 1 
                FROM crise_ticket_links ctl
                JOIN tickets t ON ctl.ticket_id = t.id
                WHERE ctl.crise_id = crise_record.id
                AND similarity(LOWER(COALESCE(t.descricao_problema, '')), 
                              LOWER(COALESCE(ticket_record.descricao_problema, ''))) > 0.5
            ) THEN
                matched_crisis_id := crise_record.id;
                EXIT;
            END IF;
        END IF;
    END LOOP;
    
    -- If no similar crisis found, create a new one
    IF matched_crisis_id IS NULL THEN
        INSERT INTO crises (
            titulo,
            descricao,
            palavras_chave,
            status,
            abriu_por
        ) VALUES (
            'Crise automática: ' || COALESCE(primary_keyword, 'sistema'),
            'Crise detectada automaticamente - ' || COALESCE(ticket_record.descricao_problema, 'Problema crítico detectado'),
            ARRAY[COALESCE(primary_keyword, 'sistema')],
            'aberto',
            COALESCE(ticket_record.criado_por, auth.uid())
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
            'Crise criada automaticamente - Ticket: ' || ticket_record.codigo_ticket,
            COALESCE(ticket_record.criado_por, auth.uid())
        );
    END IF;
    
    -- Link the ticket to the crisis
    INSERT INTO crise_ticket_links (
        crise_id,
        ticket_id,
        linked_by
    ) VALUES (
        matched_crisis_id,
        ticket_record.id,
        COALESCE(ticket_record.criado_por, auth.uid())
    ) ON CONFLICT (crise_id, ticket_id) DO NOTHING;
    
    -- Update crisis ticket count
    UPDATE crises 
    SET tickets_count = (
        SELECT COUNT(*) 
        FROM crise_ticket_links 
        WHERE crise_id = matched_crisis_id
    ),
    ultima_atualizacao = now()
    WHERE id = matched_crisis_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-create the improved trigger
DROP TRIGGER IF EXISTS detect_and_group_crise_trigger ON public.tickets;
CREATE TRIGGER detect_and_group_crise_trigger
    AFTER INSERT OR UPDATE OF prioridade ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.detect_and_group_crise_improved();

-- 6. ENSURE CRISIS STATUS TRIGGER IS ACTIVE
DROP TRIGGER IF EXISTS update_crise_is_active_trigger ON public.crises;
CREATE TRIGGER update_crise_is_active_trigger
    BEFORE INSERT OR UPDATE ON public.crises
    FOR EACH ROW
    EXECUTE FUNCTION public.update_crise_is_active();