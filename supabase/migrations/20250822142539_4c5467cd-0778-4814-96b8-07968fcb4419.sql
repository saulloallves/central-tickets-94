-- Corrigir agrupamento automático de tickets existentes em crises
CREATE OR REPLACE FUNCTION public.vincular_tickets_existentes_a_crise()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_crise_id UUID;
  v_ticket_record RECORD;
  v_similar_count INT;
BEGIN
  -- Buscar crise ativa mais recente
  SELECT id INTO v_crise_id
  FROM public.crises
  WHERE status IN ('aberto','investigando','comunicado','mitigado','reaberto')
    AND created_at >= now() - interval '2 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_crise_id IS NOT NULL THEN
    -- Buscar tickets similares não vinculados dos últimos 60 minutos
    FOR v_ticket_record IN
      SELECT t.id, t.codigo_ticket, t.descricao_problema
      FROM tickets t
      LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
      WHERE ctl.crise_id IS NULL
        AND t.data_abertura >= now() - interval '60 minutes'
        AND (
          t.descricao_problema ILIKE '%sistema caiu%'
          OR t.descricao_problema ILIKE '%sistema travou%'
          OR t.descricao_problema ILIKE '%não funciona%'
          OR t.descricao_problema ILIKE '%nao funciona%'
          OR t.categoria = 'sistema'
        )
        AND t.status <> 'concluido'
    LOOP
      -- Vincular ticket à crise existente
      INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
      VALUES (v_crise_id, v_ticket_record.id, auth.uid())
      ON CONFLICT (crise_id, ticket_id) DO NOTHING;

      -- Atualizar prioridade do ticket para crise
      UPDATE public.tickets
      SET prioridade = 'crise'::ticket_prioridade,
          escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0), 5)
      WHERE id = v_ticket_record.id 
        AND prioridade IS DISTINCT FROM 'crise'::ticket_prioridade;

      RAISE NOTICE 'Ticket % vinculado à crise %', v_ticket_record.codigo_ticket, v_crise_id;
    END LOOP;

    -- Atualizar contagem na crise
    SELECT COUNT(*) INTO v_similar_count
    FROM crise_ticket_links 
    WHERE crise_id = v_crise_id;

    UPDATE public.crises
    SET descricao = 'Crise automática com ' || v_similar_count || ' tickets vinculados',
        updated_at = now(),
        ultima_atualizacao = now()
    WHERE id = v_crise_id;

    -- Log da ação
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'crises',
      v_crise_id::TEXT,
      'Vinculação automática de tickets existentes - ' || v_similar_count || ' tickets',
      auth.uid(),
      NULL, NULL, NULL, NULL,
      jsonb_build_object('tickets_vinculados', v_similar_count),
      'painel_interno'::public.log_canal
    );
  END IF;
END;
$$;

-- Executar a função para vincular tickets existentes
SELECT public.vincular_tickets_existentes_a_crise();