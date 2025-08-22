-- Create function to auto-link new tickets to existing crises based on keywords
CREATE OR REPLACE FUNCTION public.auto_link_ticket_to_crisis()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-linking tickets to crises
DROP TRIGGER IF EXISTS auto_link_ticket_to_crisis_trigger ON public.tickets;
CREATE TRIGGER auto_link_ticket_to_crisis_trigger
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_ticket_to_crisis();

-- Create function to unlink ticket from crisis
CREATE OR REPLACE FUNCTION public.unlink_ticket_from_crisis(
  p_crise_id UUID,
  p_ticket_id UUID,
  p_by UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Remove the link
  DELETE FROM public.crise_ticket_links 
  WHERE crise_id = p_crise_id AND ticket_id = p_ticket_id;
  
  -- Add update to crisis
  INSERT INTO public.crise_updates (crise_id, tipo, mensagem, created_by)
  VALUES (p_crise_id, 'ticket_removed', 
         'Ticket desvinculado da crise', 
         COALESCE(p_by, auth.uid()));
  
  -- Log the unlinking
  PERFORM public.log_system_action(
    'acao_humana'::public.log_tipo,
    'crise_ticket_links',
    p_crise_id::TEXT,
    'Ticket desvinculado da crise',
    COALESCE(p_by, auth.uid()),
    NULL, NULL, NULL, NULL,
    jsonb_build_object('ticket_id', p_ticket_id, 'action', 'unlink'),
    'painel_interno'::public.log_canal
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;