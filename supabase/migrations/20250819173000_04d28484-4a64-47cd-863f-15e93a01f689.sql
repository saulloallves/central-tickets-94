-- Create views for metrics and dashboard calculations

-- Metrics view for tickets overview
CREATE OR REPLACE VIEW public.v_tickets_metrics AS
WITH ticket_stats AS (
  SELECT 
    DATE_TRUNC('day', data_abertura) as data,
    unidade_id,
    equipe_responsavel_id,
    status,
    prioridade,
    categoria,
    status_sla,
    criado_por,
    CASE 
      WHEN resolvido_em IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (resolvido_em - data_abertura))/3600.0 
      ELSE NULL 
    END as tempo_resolucao_horas,
    CASE 
      WHEN status_sla = 'dentro_prazo' AND status = 'concluido' THEN 1 
      ELSE 0 
    END as resolvido_no_sla,
    CASE 
      WHEN status = 'concluido' THEN 1 
      ELSE 0 
    END as resolvido,
    CASE 
      WHEN reaberto_count > 0 THEN 1 
      ELSE 0 
    END as reaberto,
    CASE 
      WHEN prioridade = 'crise' THEN 1 
      ELSE 0 
    END as crise
  FROM public.tickets
),
ia_stats AS (
  SELECT 
    t.id as ticket_id,
    t.unidade_id,
    t.equipe_responsavel_id,
    COUNT(tai.id) as interacoes_ia,
    COUNT(CASE WHEN tai.foi_usada = true THEN 1 END) as ia_usada,
    STRING_AGG(DISTINCT tai.model, ', ') as modelos_usados
  FROM public.tickets t
  LEFT JOIN public.ticket_ai_interactions tai ON t.id = tai.ticket_id
  GROUP BY t.id, t.unidade_id, t.equipe_responsavel_id
)
SELECT 
  ts.*,
  COALESCE(ias.interacoes_ia, 0) as interacoes_ia,
  COALESCE(ias.ia_usada, 0) as ia_usada,
  ias.modelos_usados,
  CASE 
    WHEN COALESCE(ias.ia_usada, 0) > 0 THEN 1 
    ELSE 0 
  END as resolvido_com_ia
FROM ticket_stats ts
LEFT JOIN ia_stats ias ON ias.ticket_id IN (
  SELECT id FROM public.tickets 
  WHERE DATE_TRUNC('day', data_abertura) = ts.data 
  AND unidade_id = ts.unidade_id
);

-- Performance metrics by team
CREATE OR REPLACE VIEW public.v_team_performance AS
SELECT 
  e.id as equipe_id,
  e.nome as equipe_nome,
  COUNT(t.id) as total_tickets,
  COUNT(CASE WHEN t.status = 'concluido' THEN 1 END) as tickets_resolvidos,
  COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END) as tickets_sla_ok,
  AVG(CASE 
    WHEN t.resolvido_em IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
  END) as tempo_medio_resolucao,
  COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END) as tickets_crise,
  COUNT(CASE WHEN t.reaberto_count > 0 THEN 1 END) as tickets_reabertos,
  COUNT(DISTINCT t.unidade_id) as unidades_atendidas,
  DATE_TRUNC('day', CURRENT_DATE) as data_calculo
FROM public.equipes e
LEFT JOIN public.tickets t ON e.id = t.equipe_responsavel_id 
  AND t.data_abertura >= CURRENT_DATE - INTERVAL '30 days'
WHERE e.ativo = true
GROUP BY e.id, e.nome;

-- Unit metrics view
CREATE OR REPLACE VIEW public.v_unit_metrics AS
SELECT 
  u.id as unidade_id,
  u.grupo as unidade_nome,
  COUNT(t.id) as total_tickets_mes,
  COUNT(CASE WHEN t.status = 'concluido' THEN 1 END) as tickets_resolvidos,
  COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END) as tickets_sla_ok,
  COUNT(CASE WHEN t.status IN ('aberto', 'em_atendimento') THEN 1 END) as tickets_abertos,
  COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END) as tickets_crise,
  AVG(CASE 
    WHEN t.resolvido_em IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
  END) as tempo_medio_resolucao,
  COUNT(tai.id) as interacoes_ia_total,
  COUNT(CASE WHEN tai.foi_usada = true THEN 1 END) as ia_bem_sucedida,
  ROUND(
    CASE 
      WHEN COUNT(t.id) > 0 THEN 
        (COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::DECIMAL / COUNT(t.id)) * 100 
      ELSE 0 
    END, 2
  ) as percentual_sla,
  DATE_TRUNC('month', CURRENT_DATE) as mes_referencia
FROM public.unidades u
LEFT JOIN public.tickets t ON u.id = t.unidade_id 
  AND t.data_abertura >= DATE_TRUNC('month', CURRENT_DATE)
LEFT JOIN public.ticket_ai_interactions tai ON t.id = tai.ticket_id
GROUP BY u.id, u.grupo;

-- Real-time KPIs function
CREATE OR REPLACE FUNCTION public.get_realtime_kpis(
  p_user_id UUID DEFAULT NULL,
  p_unidade_filter TEXT DEFAULT NULL,
  p_equipe_filter UUID DEFAULT NULL,
  p_periodo_dias INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  kpis JSONB;
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  -- Get user role
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

  -- Get accessible units based on role
  IF user_role IN ('admin', 'diretoria') THEN
    -- Full access
    accessible_units := ARRAY(SELECT id FROM public.unidades);
  ELSIF user_role = 'gerente' THEN
    -- Access to managed units
    SELECT ARRAY_AGG(u.id) INTO accessible_units
    FROM public.unidades u
    JOIN public.franqueados f ON f.unit_code ? u.id
    JOIN public.profiles p ON p.email = f.email
    WHERE p.id = p_user_id;
  ELSE
    -- Access to own unit only
    SELECT ARRAY_AGG(c.unidade_id) INTO accessible_units
    FROM public.colaboradores c
    JOIN public.profiles p ON p.email = c.email
    WHERE p.id = p_user_id;
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
$function$;

-- Function to get ticket trends for charts
CREATE OR REPLACE FUNCTION public.get_ticket_trends(
  p_user_id UUID DEFAULT NULL,
  p_dias INTEGER DEFAULT 30,
  p_unidade_filter TEXT DEFAULT NULL
) RETURNS TABLE(
  data DATE,
  total_tickets BIGINT,
  tickets_resolvidos BIGINT,
  tickets_sla_ok BIGINT,
  tempo_medio_resolucao NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  -- Get user role and accessible units (same logic as above)
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
$function$;