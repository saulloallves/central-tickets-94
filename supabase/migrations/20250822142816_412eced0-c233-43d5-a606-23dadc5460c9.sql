-- Vincular todos os tickets restantes à crise ativa
WITH crise_ativa AS (
  SELECT id FROM public.crises 
  WHERE status IN ('aberto','investigando','comunicado','mitigado','reaberto')
  ORDER BY created_at DESC 
  LIMIT 1
),
tickets_nao_vinculados AS (
  SELECT t.id, t.codigo_ticket
  FROM tickets t
  LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
  WHERE ctl.crise_id IS NULL
    AND t.data_abertura >= now() - interval '2 hours'
    AND (
      t.descricao_problema ILIKE '%sistema caiu%'
      OR t.descricao_problema ILIKE '%sistema travou%'
      OR t.categoria = 'sistema'
    )
    AND t.status <> 'concluido'
)
INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
SELECT ca.id, tnv.id, auth.uid()
FROM crise_ativa ca
CROSS JOIN tickets_nao_vinculados tnv
ON CONFLICT (crise_id, ticket_id) DO NOTHING;

-- Atualizar prioridade dos tickets não vinculados
UPDATE public.tickets
SET prioridade = 'crise'::ticket_prioridade,
    escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0), 5)
WHERE id IN (
  SELECT t.id
  FROM tickets t
  LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
  WHERE t.data_abertura >= now() - interval '2 hours'
    AND (
      t.descricao_problema ILIKE '%sistema caiu%'
      OR t.descricao_problema ILIKE '%sistema travou%'
      OR t.categoria = 'sistema'
    )
    AND t.status <> 'concluido'
    AND t.prioridade IS DISTINCT FROM 'crise'::ticket_prioridade
);

-- Melhorar trigger para auto-vinculação mais agressiva
CREATE OR REPLACE FUNCTION public.detect_and_group_crise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_keywords TEXT[] := ARRAY[
    'travou tudo','não consigo vender','nao consigo vender','cliente xingando',
    'reclamação grave','reclamacao grave','ação judicial','acao judicial',
    'urgência máxima','urgencia maxima','ameaça','advogado','procon','trava total',
    'sistema caiu','sistema travou','não funciona','nao funciona','fora do ar',
    'sistema parou','sistema fora','sistema off','sem sistema','sistema down'
  ];
  v_match BOOLEAN := FALSE;
  v_count INT := 0;
  v_crise_id UUID;
  v_title TEXT;
  v_similar_tickets INT := 0;
BEGIN
  -- Detectar palavras-chave críticas (mais sensível)
  IF NEW.descricao_problema IS NOT NULL THEN
    FOR i IN array_lower(v_keywords,1)..array_upper(v_keywords,1) LOOP
      IF NEW.descricao_problema ILIKE '%' || v_keywords[i] || '%' THEN
        v_match := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Fallback mais sensível: categoria sistema automaticamente
  IF NOT v_match AND NEW.categoria = 'sistema' THEN
    v_match := TRUE;
  END IF;

  -- Volume na mesma categoria (threshold menor para maior sensibilidade)
  IF NOT v_match AND NEW.categoria IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.tickets t
    WHERE t.data_abertura >= now() - interval '15 minutes'
      AND t.categoria = NEW.categoria
      AND t.status <> 'concluido';
    IF v_count >= 2 THEN -- Reduzido de 3 para 2
      v_match := TRUE;
    END IF;
  END IF;

  -- Se detectou critério de crise
  IF v_match THEN
    -- Verificar quantos tickets similares existem (janela maior)
    SELECT COUNT(*) INTO v_similar_tickets
    FROM public.tickets t
    WHERE t.data_abertura >= now() - interval '30 minutes' -- Aumentado de 15 para 30 min
      AND t.id != NEW.id
      AND (
        -- Categoria sistema
        t.categoria = 'sistema'
        OR
        -- Mesma categoria que o atual
        (NEW.categoria IS NOT NULL AND t.categoria = NEW.categoria)
        OR
        -- Palavras-chave similares
        (NEW.descricao_problema IS NOT NULL AND t.descricao_problema IS NOT NULL 
         AND EXISTS (
           SELECT 1 FROM unnest(v_keywords) kw 
           WHERE NEW.descricao_problema ILIKE '%'||kw||'%' 
           AND t.descricao_problema ILIKE '%'||kw||'%'
         ))
      )
      AND t.status <> 'concluido';

    -- Threshold mais baixo: 1+ tickets similares (ao invés de 2+)
    IF v_similar_tickets >= 1 THEN
      -- Buscar crise aberta similar na última 2 horas (janela maior)
      SELECT c.id INTO v_crise_id
      FROM public.crises c
      WHERE c.status IN ('aberto','investigando','comunicado','mitigado','reaberto')
        AND c.created_at >= now() - interval '2 hours' -- Aumentado de 1 para 2 horas
        AND (
          -- Categoria nas palavras-chave
          (NEW.categoria IS NOT NULL AND c.palavras_chave @> ARRAY[NEW.categoria::text])
          OR
          -- Palavras-chave em comum (mais flexível)
          EXISTS (
            SELECT 1 FROM unnest(c.palavras_chave) pk, unnest(v_keywords) kw
            WHERE (
              NEW.descricao_problema ILIKE '%'||kw||'%' 
              OR pk ILIKE '%'||kw||'%'
              OR pk = NEW.categoria::text
            )
          )
        )
      ORDER BY c.updated_at DESC
      LIMIT 1;

      IF v_crise_id IS NULL THEN
        -- Criar nova crise (títulos mais específicos)
        v_title := CASE 
          WHEN NEW.descricao_problema ILIKE '%sistema caiu%' THEN 'CRISE: Sistema Fora do Ar'
          WHEN NEW.categoria = 'sistema' THEN 'CRISE: Problemas no Sistema'
          WHEN NEW.categoria IS NOT NULL THEN 'CRISE: ' || UPPER(NEW.categoria::text)
          ELSE 'CRISE: Incidente Detectado'
        END;
        
        v_crise_id := public.create_crise(
          v_title,
          'Crise automática detectada - ' || (v_similar_tickets + 1) || ' tickets relacionados',
          CASE 
            WHEN NEW.categoria IS NOT NULL THEN ARRAY[NEW.categoria::text, 'automatico']
            ELSE ARRAY['automatico', 'deteccao']
          END,
          ARRAY[NEW.id]::uuid[],
          NULL,
          auth.uid()
        );
      ELSE
        -- Adicionar à crise existente
        PERFORM public.add_tickets_to_crise(v_crise_id, ARRAY[NEW.id]::uuid[], auth.uid());
      END IF;

      -- Log detalhado
      PERFORM public.log_system_action(
        'sistema'::public.log_tipo,
        'crises',
        COALESCE(v_crise_id::TEXT, 'null'),
        'AUTO-DETECÇÃO: ' || (v_similar_tickets + 1) || ' tickets similares agrupados',
        auth.uid(),
        NULL, NULL, NULL, NULL,
        jsonb_build_object(
          'ticket_id', NEW.id, 
          'categoria', NEW.categoria, 
          'similar_tickets', v_similar_tickets,
          'deteccao_por_palavra_chave', 
          (SELECT string_agg(kw, ', ') FROM unnest(v_keywords) kw WHERE NEW.descricao_problema ILIKE '%'||kw||'%')
        ),
        'painel_interno'::public.log_canal
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;