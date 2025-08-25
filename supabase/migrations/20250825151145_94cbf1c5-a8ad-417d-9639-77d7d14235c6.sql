-- Atualizar função get_ticket_trends para usar 'supervisor' em vez de 'gerente'
CREATE OR REPLACE FUNCTION public.get_ticket_trends(p_user_id uuid DEFAULT NULL::uuid, p_dias integer DEFAULT 30, p_unidade_filter text DEFAULT NULL::text)
RETURNS TABLE(data date, total_tickets bigint, tickets_resolvidos bigint, tickets_sla_ok bigint, tempo_medio_resolucao numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      WHEN role = 'supervisor' THEN 3  -- Atualizado de 'gerente'
      ELSE 4
    END 
  LIMIT 1;

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
    DATE_TRUNC('day', t.data_abertura)::DATE as data,
    COUNT(*)::BIGINT as total_tickets,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT as tickets_resolvidos,
    COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::BIGINT as tickets_sla_ok,
    ROUND(AVG(CASE 
      WHEN t.resolvido_em IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
    END)::NUMERIC, 2) as tempo_medio_resolucao
  FROM public.tickets t
  WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_dias
  AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
  AND (accessible_units IS NULL OR t.unidade_id = ANY(accessible_units))
  GROUP BY DATE_TRUNC('day', t.data_abertura)
  ORDER BY data DESC;
END;
$$;

-- Atualizar função get_realtime_kpis para usar 'supervisor' em vez de 'gerente'
CREATE OR REPLACE FUNCTION public.get_realtime_kpis(p_user_id uuid DEFAULT NULL::uuid, p_unidade_filter text DEFAULT NULL::text, p_equipe_filter uuid DEFAULT NULL::uuid, p_periodo_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kpis JSONB;
  user_role TEXT;
  accessible_units TEXT[];
  effective_user_id UUID;
BEGIN
  -- Use auth.uid() if p_user_id is not provided
  effective_user_id := COALESCE(p_user_id, auth.uid());
  
  -- If still no user ID, provide public/limited view
  IF effective_user_id IS NULL THEN
    -- Return basic metrics without user-specific filtering
    WITH filtered_tickets AS (
      SELECT *
      FROM public.tickets t
      WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
      AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
      AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id = p_equipe_filter)
    ),
    kpi_calc AS (
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'concluido' THEN 1 END) as tickets_resolvidos,
        COUNT(CASE WHEN status IN ('aberto', 'em_atendimento') THEN 1 END) as tickets_abertos,
        COUNT(CASE WHEN status_sla = 'vencido' THEN 1 END) as tickets_sla_vencido,
        COUNT(CASE WHEN status_sla = 'dentro_prazo' AND status = 'concluido' THEN 1 END) as tickets_sla_ok,
        COUNT(CASE WHEN prioridade = 'crise' THEN 1 END) as tickets_crise,
        COUNT(CASE WHEN reaberto_count > 0 THEN 1 END) as tickets_reabertos,
        AVG(CASE 
          WHEN resolvido_em IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (resolvido_em - data_abertura))/3600.0 
        END) as tempo_medio_resolucao,
        COUNT(DISTINCT unidade_id) as unidades_ativas,
        COUNT(DISTINCT equipe_responsavel_id) as equipes_ativas
      FROM filtered_tickets
    )
    SELECT jsonb_build_object(
      'total_tickets', COALESCE(kc.total_tickets, 0),
      'tickets_resolvidos', COALESCE(kc.tickets_resolvidos, 0),
      'tickets_abertos', COALESCE(kc.tickets_abertos, 0),
      'tickets_sla_vencido', COALESCE(kc.tickets_sla_vencido, 0),
      'tickets_sla_ok', COALESCE(kc.tickets_sla_ok, 0),
      'tickets_crise', COALESCE(kc.tickets_crise, 0),
      'tickets_reabertos', COALESCE(kc.tickets_reabertos, 0),
      'tempo_medio_resolucao', ROUND(COALESCE(kc.tempo_medio_resolucao, 0)::NUMERIC, 2),
      'unidades_ativas', COALESCE(kc.unidades_ativas, 0),
      'equipes_ativas', COALESCE(kc.equipes_ativas, 0),
      'percentual_sla', 
        CASE 
          WHEN COALESCE(kc.total_tickets, 0) > 0 THEN 
            ROUND((COALESCE(kc.tickets_sla_ok, 0)::DECIMAL / kc.total_tickets) * 100, 2)
          ELSE 0 
        END,
      'percentual_resolucao',
        CASE 
          WHEN COALESCE(kc.total_tickets, 0) > 0 THEN 
            ROUND((COALESCE(kc.tickets_resolvidos, 0)::DECIMAL / kc.total_tickets) * 100, 2)
          ELSE 0 
        END,
      'total_interacoes_ia', 0,
      'ia_usada_sucesso', 0,
      'tickets_com_ia', 0,
      'modelos_diferentes_usados', 0,
      'percentual_ia_sucesso', 0,
      'periodo_dias', p_periodo_dias,
      'data_calculo', CURRENT_TIMESTAMP
    ) INTO kpis
    FROM kpi_calc kc;
    
    RETURN kpis;
  END IF;

  -- Get user role
  SELECT role INTO user_role 
  FROM public.user_roles ur 
  WHERE ur.user_id = effective_user_id 
  ORDER BY 
    CASE 
      WHEN role = 'admin' THEN 1
      WHEN role = 'diretoria' THEN 2  
      WHEN role = 'supervisor' THEN 3  -- Atualizado de 'gerente'
      ELSE 4
    END 
  LIMIT 1;

  -- Get accessible units based on role
  IF user_role IN ('admin', 'diretoria') THEN
    -- Full access
    accessible_units := ARRAY(SELECT id FROM public.unidades);
  ELSIF user_role = 'supervisor' THEN  -- Atualizado de 'gerente'
    -- Access to managed units
    SELECT ARRAY_AGG(u.id) INTO accessible_units
    FROM public.unidades u
    JOIN public.franqueados f ON f.unit_code ? u.id
    JOIN public.profiles p ON p.email = f.email
    WHERE p.id = effective_user_id;
  ELSE
    -- Access to own unit only
    SELECT ARRAY_AGG(c.unidade_id) INTO accessible_units
    FROM public.colaboradores c
    JOIN public.profiles p ON p.email = c.email
    WHERE p.id = effective_user_id;
  END IF;

  -- Calculate KPIs
  WITH filtered_tickets AS (
    SELECT *
    FROM public.tickets t
    WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
    AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
    AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id = p_equipe_filter)
    AND (accessible_units IS NULL OR t.unidade_id = ANY(accessible_units))
  ),
  kpi_calc AS (
    SELECT 
      COUNT(*) as total_tickets,
      COUNT(CASE WHEN status = 'concluido' THEN 1 END) as tickets_resolvidos,
      COUNT(CASE WHEN status IN ('aberto', 'em_atendimento') THEN 1 END) as tickets_abertos,
      COUNT(CASE WHEN status_sla = 'vencido' THEN 1 END) as tickets_sla_vencido,
      COUNT(CASE WHEN status_sla = 'dentro_prazo' AND status = 'concluido' THEN 1 END) as tickets_sla_ok,
      COUNT(CASE WHEN prioridade = 'crise' THEN 1 END) as tickets_crise,
      COUNT(CASE WHEN reaberto_count > 0 THEN 1 END) as tickets_reabertos,
      AVG(CASE 
        WHEN resolvido_em IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (resolvido_em - data_abertura))/3600.0 
      END) as tempo_medio_resolucao,
      COUNT(DISTINCT unidade_id) as unidades_ativas,
      COUNT(DISTINCT equipe_responsavel_id) as equipes_ativas
    FROM filtered_tickets
  ),
  ia_kpis AS (
    SELECT 
      COUNT(tai.id) as total_interacoes_ia,
      COUNT(CASE WHEN tai.foi_usada = true THEN 1 END) as ia_usada_sucesso,
      COUNT(DISTINCT tai.ticket_id) as tickets_com_ia,
      COUNT(DISTINCT tai.model) as modelos_diferentes_usados
    FROM public.ticket_ai_interactions tai
    JOIN filtered_tickets ft ON tai.ticket_id = ft.id
  )
  SELECT jsonb_build_object(
    'total_tickets', COALESCE(kc.total_tickets, 0),
    'tickets_resolvidos', COALESCE(kc.tickets_resolvidos, 0),
    'tickets_abertos', COALESCE(kc.tickets_abertos, 0),
    'tickets_sla_vencido', COALESCE(kc.tickets_sla_vencido, 0),
    'tickets_sla_ok', COALESCE(kc.tickets_sla_ok, 0),
    'tickets_crise', COALESCE(kc.tickets_crise, 0),
    'tickets_reabertos', COALESCE(kc.tickets_reabertos, 0),
    'tempo_medio_resolucao', ROUND(COALESCE(kc.tempo_medio_resolucao, 0)::NUMERIC, 2),
    'unidades_ativas', COALESCE(kc.unidades_ativas, 0),
    'equipes_ativas', COALESCE(kc.equipes_ativas, 0),
    'percentual_sla', 
      CASE 
        WHEN COALESCE(kc.total_tickets, 0) > 0 THEN 
          ROUND((COALESCE(kc.tickets_sla_ok, 0)::DECIMAL / kc.total_tickets) * 100, 2)
        ELSE 0 
      END,
    'percentual_resolucao',
      CASE 
        WHEN COALESCE(kc.total_tickets, 0) > 0 THEN 
          ROUND((COALESCE(kc.tickets_resolvidos, 0)::DECIMAL / kc.total_tickets) * 100, 2)
        ELSE 0 
      END,
    'total_interacoes_ia', COALESCE(iak.total_interacoes_ia, 0),
    'ia_usada_sucesso', COALESCE(iak.ia_usada_sucesso, 0),
    'tickets_com_ia', COALESCE(iak.tickets_com_ia, 0),
    'modelos_diferentes_usados', COALESCE(iak.modelos_diferentes_usados, 0),
    'percentual_ia_sucesso',
      CASE 
        WHEN COALESCE(iak.total_interacoes_ia, 0) > 0 THEN 
          ROUND((COALESCE(iak.ia_usada_sucesso, 0)::DECIMAL / iak.total_interacoes_ia) * 100, 2)
        ELSE 0 
      END,
    'periodo_dias', p_periodo_dias,
    'data_calculo', CURRENT_TIMESTAMP
  ) INTO kpis
  FROM kpi_calc kc
  CROSS JOIN ia_kpis iak;

  RETURN kpis;
END;
$$;