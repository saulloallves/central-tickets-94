-- Create RPC for team metrics
CREATE OR REPLACE FUNCTION public.get_team_metrics(
  p_user_id uuid DEFAULT NULL::uuid,
  p_periodo_dias integer DEFAULT 30,
  p_unidade_filter text DEFAULT NULL::text
)
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
SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  -- Get user role and accessible units (same logic as get_realtime_kpis)
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
    e.id as equipe_id,
    e.nome as equipe_nome,
    COUNT(t.id)::BIGINT as total_tickets,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT as tickets_resolvidos,
    COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::BIGINT as tickets_sla_ok,
    ROUND(AVG(CASE 
      WHEN t.resolvido_em IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
    END)::NUMERIC, 2) as tempo_medio_resolucao,
    COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END)::BIGINT as tickets_crise,
    COUNT(CASE WHEN t.reaberto_count > 0 THEN 1 END)::BIGINT as tickets_reabertos,
    COUNT(DISTINCT t.unidade_id)::BIGINT as unidades_atendidas
  FROM public.equipes e
  LEFT JOIN public.tickets t ON t.equipe_responsavel_id = e.id
    AND t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
    AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
    AND (accessible_units IS NULL OR t.unidade_id = ANY(accessible_units))
  WHERE e.ativo = true
  GROUP BY e.id, e.nome
  ORDER BY total_tickets DESC;
END;
$function$;

-- Create RPC for unit metrics
CREATE OR REPLACE FUNCTION public.get_unit_metrics(
  p_user_id uuid DEFAULT NULL::uuid,
  p_periodo_dias integer DEFAULT 30,
  p_equipe_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  unidade_id text,
  unidade_nome text,
  total_tickets_mes bigint,
  tickets_resolvidos bigint,
  tickets_sla_ok bigint,
  tickets_abertos bigint,
  tickets_crise bigint,
  tempo_medio_resolucao numeric,
  interacoes_ia_total bigint,
  ia_bem_sucedida bigint,
  percentual_sla numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  -- Get user role and accessible units
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
    u.id as unidade_id,
    u.nome as unidade_nome,
    COUNT(t.id)::BIGINT as total_tickets_mes,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT as tickets_resolvidos,
    COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::BIGINT as tickets_sla_ok,
    COUNT(CASE WHEN t.status IN ('aberto', 'em_atendimento', 'escalonado') THEN 1 END)::BIGINT as tickets_abertos,
    COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END)::BIGINT as tickets_crise,
    ROUND(AVG(CASE 
      WHEN t.resolvido_em IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
    END)::NUMERIC, 2) as tempo_medio_resolucao,
    COUNT(tai.id)::BIGINT as interacoes_ia_total,
    COUNT(CASE WHEN tai.foi_usada = true THEN 1 END)::BIGINT as ia_bem_sucedida,
    CASE 
      WHEN COUNT(t.id) > 0 THEN 
        ROUND((COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::DECIMAL / COUNT(t.id)) * 100, 2)
      ELSE 0 
    END as percentual_sla
  FROM public.unidades u
  LEFT JOIN public.tickets t ON t.unidade_id = u.id
    AND t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
    AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id = p_equipe_filter)
    AND (accessible_units IS NULL OR t.unidade_id = ANY(accessible_units))
  LEFT JOIN public.ticket_ai_interactions tai ON tai.ticket_id = t.id
  WHERE u.ativo = true
  GROUP BY u.id, u.nome
  ORDER BY total_tickets_mes DESC;
END;
$function$;