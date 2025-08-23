
-- Remover versões antigas (se existirem), para evitar conflito de assinatura
DROP FUNCTION IF EXISTS public.get_unit_metrics(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.get_unit_metrics(uuid, integer, text);

-- Criar versão definitiva e robusta
CREATE OR REPLACE FUNCTION public.get_unit_metrics(
  p_user_id UUID,
  p_periodo_dias INTEGER DEFAULT 30,
  p_equipe_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  unidade_id TEXT,
  unidade_nome TEXT,
  total_tickets_mes BIGINT,
  tickets_resolvidos BIGINT,
  tickets_abertos BIGINT,
  percentual_sla NUMERIC,
  tempo_medio_resolucao NUMERIC,
  tickets_crise BIGINT,
  ia_bem_sucedida BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  -- Papel do usuário (mesma lógica usada nas demais funções)
  SELECT role INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id
  ORDER BY
    CASE
      WHEN role = 'admin' THEN 1
      WHEN role = 'diretoria' THEN 2
      WHEN role = 'gerente' THEN 3
      ELSE 4
    END
  LIMIT 1;

  -- Unidades acessíveis por papel
  IF user_role IN ('admin', 'diretoria') THEN
    accessible_units := ARRAY(
      SELECT DISTINCT t.unidade_id
      FROM public.tickets t
      WHERE t.unidade_id IS NOT NULL
    );
  ELSIF user_role = 'gerente' THEN
    SELECT ARRAY_AGG(u.id) INTO accessible_units
    FROM (
      SELECT DISTINCT jsonb_array_elements_text(f.unit_code) AS id
      FROM public.franqueados f
      JOIN public.profiles p ON p.email = f.email
      WHERE p.id = p_user_id
    ) u;
  ELSE
    SELECT ARRAY_AGG(c.unidade_id) INTO accessible_units
    FROM public.colaboradores c
    JOIN public.profiles p ON p.email = c.email
    WHERE p.id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    t.unidade_id,
    -- Caso não exista tabela de unidades com "nome", usamos o próprio id como nome
    t.unidade_id AS unidade_nome,
    COUNT(*)::BIGINT AS total_tickets_mes,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT AS tickets_resolvidos,
    -- Aberto = tudo que não está concluído (evita depender de valores específicos de enum)
    COUNT(CASE WHEN t.status <> 'concluido' THEN 1 END)::BIGINT AS tickets_abertos,
    ROUND(
      COALESCE(
        (COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::NUMERIC
          / NULLIF(COUNT(*), 0)) * 100,
        0
      )::NUMERIC, 2
    ) AS percentual_sla,
    ROUND(
      AVG(
        CASE WHEN t.resolvido_em IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura)) / 3600.0
        END
      )::NUMERIC, 2
    ) AS tempo_medio_resolucao,
    COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END)::BIGINT AS tickets_crise,
    COUNT(
      CASE WHEN EXISTS (
        SELECT 1
        FROM public.ticket_ai_interactions tai
        WHERE tai.ticket_id = t.id
          AND tai.foi_usada = TRUE
      ) THEN 1 END
    )::BIGINT AS ia_bem_sucedida
  FROM public.tickets t
  WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
    AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id::text = p_equipe_filter)
    AND (accessible_units IS NULL OR t.unidade_id = ANY (accessible_units))
  GROUP BY t.unidade_id
  HAVING COUNT(*) > 0
  ORDER BY total_tickets_mes DESC;
END;
$$;
