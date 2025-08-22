-- Verificar e corrigir detecção automática de crise
-- Primeiro, garantir que a extensão pg_trgm está instalada
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verificar se o trigger está aplicado corretamente
DROP TRIGGER IF EXISTS detect_crise_trigger ON tickets;

CREATE TRIGGER detect_crise_trigger
AFTER INSERT OR UPDATE ON tickets
FOR EACH ROW
WHEN (NEW.prioridade = 'crise')
EXECUTE FUNCTION detect_and_group_enhanced_crise();

-- Função para manualmente vincular tickets existentes similares
CREATE OR REPLACE FUNCTION public.vincular_tickets_similares_manual()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_crise_id UUID;
  v_ticket_record RECORD;
  v_similar_count INT := 0;
  v_result TEXT := '';
BEGIN
  -- Buscar tickets similares de "girabot" não vinculados
  FOR v_ticket_record IN
    SELECT t.id, t.codigo_ticket, t.descricao_problema, t.criado_por
    FROM tickets t
    LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
    WHERE ctl.crise_id IS NULL
      AND t.prioridade = 'crise'
      AND t.status IN ('escalonado', 'em_atendimento', 'aberto')
      AND t.data_abertura >= now() - interval '4 hours'
      AND LOWER(t.descricao_problema) LIKE '%girabot%'
    ORDER BY t.data_abertura DESC
  LOOP
    v_similar_count := v_similar_count + 1;
  END LOOP;

  IF v_similar_count >= 3 THEN
    -- Criar nova crise
    INSERT INTO public.crises (
      titulo,
      descricao,
      palavras_chave,
      status,
      abriu_por
    ) VALUES (
      'Crise automática: girabot',
      'Crise detectada manualmente - ' || v_similar_count || ' tickets sobre girabot não funcionando',
      ARRAY['girabot'],
      'aberto',
      (SELECT criado_por FROM tickets WHERE LOWER(descricao_problema) LIKE '%girabot%' AND prioridade = 'crise' LIMIT 1)
    ) RETURNING id INTO v_crise_id;

    -- Vincular todos os tickets similares
    FOR v_ticket_record IN
      SELECT t.id, t.codigo_ticket, t.descricao_problema, t.criado_por
      FROM tickets t
      LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
      WHERE ctl.crise_id IS NULL
        AND t.prioridade = 'crise'
        AND t.status IN ('escalonado', 'em_atendimento', 'aberto')
        AND t.data_abertura >= now() - interval '4 hours'
        AND LOWER(t.descricao_problema) LIKE '%girabot%'
    LOOP
      INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
      VALUES (v_crise_id, v_ticket_record.id, v_ticket_record.criado_por)
      ON CONFLICT (crise_id, ticket_id) DO NOTHING;
    END LOOP;

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
      'Crise criada manualmente - ' || v_similar_count || ' tickets sobre girabot',
      (SELECT criado_por FROM tickets WHERE LOWER(descricao_problema) LIKE '%girabot%' AND prioridade = 'crise' LIMIT 1)
    );

    v_result := 'Crise criada com ID: ' || v_crise_id || ' - ' || v_similar_count || ' tickets vinculados';
  ELSE
    v_result := 'Apenas ' || v_similar_count || ' tickets encontrados (mínimo 3 necessário)';
  END IF;

  RETURN v_result;
END;
$function$;

-- Executar a função para vincular tickets existentes
SELECT vincular_tickets_similares_manual();