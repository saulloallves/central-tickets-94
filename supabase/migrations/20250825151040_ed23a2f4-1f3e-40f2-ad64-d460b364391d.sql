-- Remover e recriar funções com dependências de parâmetros
DROP FUNCTION IF EXISTS public.get_team_metrics(uuid, integer, text);
DROP FUNCTION IF EXISTS public.get_unit_metrics(uuid, integer, text);

-- Recriar função get_team_metrics sem parâmetros padrão primeiro
CREATE OR REPLACE FUNCTION public.get_team_metrics(p_user_id uuid, p_periodo_dias integer, p_unidade_filter text)
RETURNS TABLE(
  equipe_id uuid,
  equipe_nome text,
  total_tickets bigint,
  tickets_resolvidos bigint,
  tickets_sla_ok bigint,
  tempo_medio_resolucao numeric,
  tickets_crise bigint,
  tickets_reabertos bigint,
  unidades_atendidas bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(p_user_id, 'admin'::app_role) OR 
    has_role(p_user_id, 'diretoria'::app_role) OR
    has_role(p_user_id, 'supervisor'::app_role) OR
    has_role(p_user_id, 'diretor'::app_role) OR
    has_role(p_user_id, 'colaborador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para acessar métricas das equipes';
  END IF;

  RETURN QUERY
  WITH filtered_tickets AS (
    SELECT t.*
    FROM tickets t
    WHERE 
      (p_periodo_dias = 0 OR t.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias)
      AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
      AND (
        has_role(p_user_id, 'admin'::app_role) OR 
        has_role(p_user_id, 'diretoria'::app_role) OR
        can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
      )
  )
  SELECT 
    COALESCE(e.id, '00000000-0000-0000-0000-000000000000'::uuid) as equipe_id,
    COALESCE(e.nome, 'Sem Equipe') as equipe_nome,
    COUNT(ft.id)::bigint as total_tickets,
    COUNT(ft.id) FILTER (WHERE ft.status = 'resolvido')::bigint as tickets_resolvidos,
    COUNT(ft.id) FILTER (WHERE ft.sla_status = 'dentro_prazo')::bigint as tickets_sla_ok,
    COALESCE(AVG(
      CASE 
        WHEN ft.status = 'resolvido' AND ft.atendimento_iniciado_em IS NOT NULL AND ft.resolvido_em IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ft.resolvido_em - ft.atendimento_iniciado_em))/3600 
      END
    ), 0)::numeric as tempo_medio_resolucao,
    COUNT(ft.id) FILTER (WHERE ft.prioridade = 'crítica')::bigint as tickets_crise,
    COUNT(ft.id) FILTER (WHERE ft.reabertura_count > 0)::bigint as tickets_reabertos,
    COUNT(DISTINCT ft.unidade_id)::bigint as unidades_atendidas
  FROM filtered_tickets ft
  LEFT JOIN equipes e ON e.id = ft.equipe_responsavel_id
  GROUP BY e.id, e.nome
  ORDER BY total_tickets DESC;
END;
$$;

-- Agora criar a função get_unit_metrics atualizada
CREATE OR REPLACE FUNCTION public.get_unit_metrics(p_user_id uuid, p_periodo_dias integer, p_equipe_filter text)
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
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  -- Papel do usuário - atualizado para usar 'supervisor' em vez de 'gerente'
  SELECT role INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id
  ORDER BY
    CASE
      WHEN role = 'admin' THEN 1
      WHEN role = 'diretoria' THEN 2
      WHEN role = 'supervisor' THEN 3  -- Atualizado de 'gerente'
      ELSE 4
    END
  LIMIT 1;

  -- Unidades acessíveis conforme papel
  IF user_role IN ('admin', 'diretoria') THEN
    accessible_units := ARRAY(SELECT id FROM public.unidades);
  ELSIF user_role = 'supervisor' THEN  -- Atualizado de 'gerente'
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
    COALESCE(u.grupo, u.id) AS unidade_nome,
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
$$;