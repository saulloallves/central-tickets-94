
CREATE OR REPLACE FUNCTION public.get_unit_metrics(
  p_user_id uuid,
  p_periodo_dias integer DEFAULT 30,
  p_equipe_filter text DEFAULT NULL
)
RETURNS TABLE(
  unidade_id text,
  unidade_nome text,
  total_tickets_mes bigint,
  tickets_resolvidos bigint,
  tickets_abertos bigint,
  percentual_sla numeric,
  tempo_medio_resolucao numeric,
  tickets_crise bigint,
  ia_bem_sucedida bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  -- Papel do usuário
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

  -- Unidades acessíveis conforme papel
  IF user_role IN ('admin', 'diretoria') THEN
    accessible_units := ARRAY(SELECT id FROM public.unidades);
  ELSIF user_role = 'gerente' THEN
    SELECT ARRAY_AGG(u.id) INTO accessible_units
    FROM public.unidades u
    JOIN public.franqueados f ON f.unit_code ? u.id
    JOIN public.profiles p ON p.email = f.email
    WHERE p.id = p_user_id;
  ELSE
    SELECT ARRAY_AGG(c.unidade_id) INTO accessible_units
    FROM public.colaboradores c
    JOIN public.profiles p ON p.email = c.email
    WHERE p.id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    u.id AS unidade_id,
    COALESCE(u.grupo, u.id) AS unidade_nome,  -- Usa nome amigável (grupo); fallback para id
    COUNT(t.id)::BIGINT AS total_tickets_mes,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT AS tickets_resolvidos,
    COUNT(CASE WHEN t.status <> 'concluido' THEN 1 END)::BIGINT AS tickets_abertos,
    ROUND(
      CASE 
        WHEN COUNT(t.id) > 0 THEN 
          (COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::DECIMAL / COUNT(t.id)) * 100
        ELSE 0
      END
    , 2) AS percentual_sla,
    ROUND(
      AVG(
        CASE WHEN t.resolvido_em IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura)) / 3600.0
      END
    )::NUMERIC, 2) AS tempo_medio_resolucao,
    COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END)::BIGINT AS tickets_crise,
    COUNT(
      CASE WHEN EXISTS (
        SELECT 1
        FROM public.ticket_ai_interactions tai
        WHERE tai.ticket_id = t.id
          AND tai.foi_usada = TRUE
      ) THEN 1 END
    )::BIGINT AS ia_bem_sucedida
  FROM public.unidades u
  LEFT JOIN public.tickets t
    ON t.unidade_id = u.id
   AND t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
   AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id::text = p_equipe_filter)
  WHERE (accessible_units IS NULL OR u.id = ANY (accessible_units))
  GROUP BY u.id, u.grupo
  HAVING COUNT(t.id) > 0
  ORDER BY total_tickets_mes DESC;
END;
$function$;
