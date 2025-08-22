-- Melhorar detecção e agrupamento automático de crises
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
    'sistema caiu','sistema travou','não funciona','nao funciona','fora do ar'
  ];
  v_match BOOLEAN := FALSE;
  v_count INT := 0;
  v_crise_id UUID;
  v_title TEXT;
  v_similar_tickets INT := 0;
BEGIN
  -- Detectar palavras-chave críticas
  IF NEW.descricao_problema IS NOT NULL THEN
    FOR i IN array_lower(v_keywords,1)..array_upper(v_keywords,1) LOOP
      IF NEW.descricao_problema ILIKE '%' || v_keywords[i] || '%' THEN
        v_match := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Fallback: volume na mesma categoria nos últimos 10 minutos
  IF NOT v_match AND NEW.categoria IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.tickets t
    WHERE t.data_abertura >= now() - interval '10 minutes'
      AND t.categoria = NEW.categoria
      AND t.status <> 'concluido';
    IF v_count >= 3 THEN
      v_match := TRUE;
    END IF;
  END IF;

  -- Se detectou critério de crise
  IF v_match THEN
    -- Verificar quantos tickets similares existem nos últimos 15 minutos
    SELECT COUNT(*) INTO v_similar_tickets
    FROM public.tickets t
    WHERE t.data_abertura >= now() - interval '15 minutes'
      AND t.id != NEW.id
      AND (
        -- Mesma categoria
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

    -- Se há 2+ tickets similares, buscar crise ativa ou criar nova
    IF v_similar_tickets >= 2 THEN
      -- Buscar crise aberta similar na última hora
      SELECT c.id INTO v_crise_id
      FROM public.crises c
      WHERE c.status IN ('aberto','investigando','comunicado','mitigado','reaberto')
        AND c.created_at >= now() - interval '60 minutes'
        AND (
          -- Mesma categoria nas palavras-chave
          (NEW.categoria IS NOT NULL AND c.palavras_chave @> ARRAY[NEW.categoria::text])
          OR
          -- Palavras-chave em comum
          EXISTS (
            SELECT 1 FROM unnest(c.palavras_chave) pk, unnest(v_keywords) kw
            WHERE NEW.descricao_problema ILIKE '%'||kw||'%' 
            AND pk ILIKE '%'||kw||'%'
          )
        )
      ORDER BY c.updated_at DESC
      LIMIT 1;

      IF v_crise_id IS NULL THEN
        -- Criar nova crise
        v_title := CASE 
          WHEN NEW.categoria IS NOT NULL THEN 'Crise automática: ' || NEW.categoria::text
          WHEN NEW.descricao_problema ILIKE '%sistema%' THEN 'Crise automática: Problemas no Sistema'
          ELSE 'Crise automática detectada'
        END;
        
        v_crise_id := public.create_crise(
          v_title,
          'Crise criada automaticamente - ' || v_similar_tickets || ' tickets similares detectados',
          CASE 
            WHEN NEW.categoria IS NOT NULL THEN ARRAY[NEW.categoria::text]
            ELSE ARRAY['automatico']
          END,
          ARRAY[NEW.id]::uuid[],
          NULL,
          auth.uid()
        );
      ELSE
        -- Adicionar à crise existente
        PERFORM public.add_tickets_to_crise(v_crise_id, ARRAY[NEW.id]::uuid[], auth.uid());
      END IF;

      -- Log da detecção
      PERFORM public.log_system_action(
        'sistema'::public.log_tipo,
        'crises',
        COALESCE(v_crise_id::TEXT, 'null'),
        'Detecção automática de crise - ' || v_similar_tickets || ' tickets similares',
        auth.uid(),
        NULL, NULL, NULL, NULL,
        jsonb_build_object('ticket_id', NEW.id, 'categoria', NEW.categoria, 'similar_tickets', v_similar_tickets),
        'painel_interno'::public.log_canal
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;