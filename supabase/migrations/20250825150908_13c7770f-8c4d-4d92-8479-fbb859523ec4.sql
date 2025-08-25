-- Atualizar todas as funções RPC que usam o enum app_role
-- Recriar get_user_kpis function
CREATE OR REPLACE FUNCTION public.get_user_kpis(p_user_id uuid, p_periodo_dias integer DEFAULT 30)
RETURNS TABLE(
  total_tickets bigint,
  tickets_abertos bigint,
  tickets_em_andamento bigint,
  tickets_resolvidos bigint,
  tickets_sla_ok bigint,
  tempo_medio_resolucao numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(p_user_id, 'admin'::app_role) OR 
    has_role(p_user_id, 'diretoria'::app_role) OR
    has_role(p_user_id, 'supervisor'::app_role) OR  -- Atualizado de 'gerente'
    has_role(p_user_id, 'diretor'::app_role) OR
    has_role(p_user_id, 'colaborador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para acessar KPIs';
  END IF;

  RETURN QUERY
  WITH filtered_tickets AS (
    SELECT t.*
    FROM tickets t
    WHERE 
      (p_periodo_dias = 0 OR t.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias)
      AND (
        has_role(p_user_id, 'admin'::app_role) OR 
        has_role(p_user_id, 'diretoria'::app_role) OR
        can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
      )
  )
  SELECT 
    COUNT(*)::bigint as total_tickets,
    COUNT(*) FILTER (WHERE status = 'aberto')::bigint as tickets_abertos,
    COUNT(*) FILTER (WHERE status = 'em_andamento')::bigint as tickets_em_andamento,
    COUNT(*) FILTER (WHERE status = 'resolvido')::bigint as tickets_resolvidos,
    COUNT(*) FILTER (WHERE sla_status = 'dentro_prazo')::bigint as tickets_sla_ok,
    COALESCE(AVG(
      CASE 
        WHEN status = 'resolvido' AND atendimento_iniciado_em IS NOT NULL AND resolvido_em IS NOT NULL
        THEN EXTRACT(EPOCH FROM (resolvido_em - atendimento_iniciado_em))/3600 
      END
    ), 0)::numeric as tempo_medio_resolucao
  FROM filtered_tickets;
END;
$$;

-- Recriar get_ticket_trends function  
CREATE OR REPLACE FUNCTION public.get_ticket_trends(p_user_id uuid, p_periodo_dias integer DEFAULT 30)
RETURNS TABLE(
  data date,
  tickets_criados bigint,
  tickets_resolvidos bigint,
  tempo_medio_resolucao numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(p_user_id, 'admin'::app_role) OR 
    has_role(p_user_id, 'diretoria'::app_role) OR
    has_role(p_user_id, 'supervisor'::app_role) OR  -- Atualizado de 'gerente'
    has_role(p_user_id, 'diretor'::app_role) OR
    has_role(p_user_id, 'colaborador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para acessar trends';
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '1 day' * (p_periodo_dias - 1),
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date as data
  ),
  filtered_tickets AS (
    SELECT t.*
    FROM tickets t
    WHERE 
      t.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
      AND (
        has_role(p_user_id, 'admin'::app_role) OR 
        has_role(p_user_id, 'diretoria'::app_role) OR
        can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
      )
  )
  SELECT 
    ds.data,
    COUNT(ft.id) FILTER (WHERE ft.created_at::date = ds.data)::bigint as tickets_criados,
    COUNT(ft.id) FILTER (WHERE ft.resolvido_em::date = ds.data)::bigint as tickets_resolvidos,
    COALESCE(AVG(
      CASE 
        WHEN ft.resolvido_em::date = ds.data AND ft.atendimento_iniciado_em IS NOT NULL AND ft.resolvido_em IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ft.resolvido_em - ft.atendimento_iniciado_em))/3600 
      END
    ), 0)::numeric as tempo_medio_resolucao
  FROM date_series ds
  LEFT JOIN filtered_tickets ft ON TRUE
  GROUP BY ds.data
  ORDER BY ds.data;
END;
$$;

-- Recriar get_team_metrics function
CREATE OR REPLACE FUNCTION public.get_team_metrics(p_user_id uuid, p_periodo_dias integer DEFAULT 30, p_unidade_filter text DEFAULT NULL)
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
    has_role(p_user_id, 'supervisor'::app_role) OR  -- Atualizado de 'gerente'
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

-- Recriar get_unit_metrics function
CREATE OR REPLACE FUNCTION public.get_unit_metrics(p_user_id uuid, p_periodo_dias integer DEFAULT 30)
RETURNS TABLE(
  unidade_id text,
  unidade_nome text,
  total_tickets bigint,
  tickets_resolvidos bigint,
  tickets_sla_ok bigint,
  tempo_medio_resolucao numeric,
  tickets_crise bigint,
  tickets_reabertos bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(p_user_id, 'admin'::app_role) OR 
    has_role(p_user_id, 'diretoria'::app_role) OR
    has_role(p_user_id, 'supervisor'::app_role) OR  -- Atualizado de 'gerente'
    has_role(p_user_id, 'diretor'::app_role) OR
    has_role(p_user_id, 'colaborador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para acessar métricas das unidades';
  END IF;

  RETURN QUERY
  WITH filtered_tickets AS (
    SELECT t.*
    FROM tickets t
    WHERE 
      (p_periodo_dias = 0 OR t.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias)
      AND (
        has_role(p_user_id, 'admin'::app_role) OR 
        has_role(p_user_id, 'diretoria'::app_role) OR
        can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
      )
  )
  SELECT 
    COALESCE(ft.unidade_id, 'sem_unidade') as unidade_id,
    COALESCE(u.nome, ft.unidade_id, 'Sem Unidade') as unidade_nome,
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
    COUNT(ft.id) FILTER (WHERE ft.reabertura_count > 0)::bigint as tickets_reabertos
  FROM filtered_tickets ft
  LEFT JOIN unidades u ON u.id = ft.unidade_id
  GROUP BY ft.unidade_id, u.nome
  ORDER BY total_tickets DESC;
END;
$$;