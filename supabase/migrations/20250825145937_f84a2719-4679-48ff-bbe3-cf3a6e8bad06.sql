-- Atualizar enum para trocar 'gerente' por 'supervisor'
ALTER TYPE app_role RENAME VALUE 'gerente' TO 'supervisor';

-- Atualizar todas as políticas RLS que usavam 'gerente' para usar 'supervisor'
DROP POLICY IF EXISTS "Gerentes view ai_feedback for manageable tickets" ON public.ai_feedback;
CREATE POLICY "Supervisores view ai_feedback for manageable tickets" 
ON public.ai_feedback 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ai_feedback.ticket_id) AND public.can_update_ticket(t.unidade_id))));

DROP POLICY IF EXISTS "Gerentes can view colaboradores in their units" ON public.colaboradores;
CREATE POLICY "Supervisores can view colaboradores in their units" 
ON public.colaboradores 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role) AND (unidade_id IN ( SELECT u.id
   FROM ((unidades u
     JOIN franqueados f ON ((f.unit_code ? u.id)))
     JOIN profiles p ON ((p.email = f.email)))
  WHERE (p.id = auth.uid()))));

DROP POLICY IF EXISTS "Gerentes view escalation_levels" ON public.escalation_levels;
CREATE POLICY "Supervisores view escalation_levels" 
ON public.escalation_levels 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Gerentes view escalation_logs" ON public.escalation_logs;
CREATE POLICY "Supervisores view escalation_logs" 
ON public.escalation_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Gerentes can view knowledge_suggestions" ON public.knowledge_suggestions;
CREATE POLICY "Supervisores can view knowledge_suggestions" 
ON public.knowledge_suggestions 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Gerentes view notification_routes" ON public.notification_routes;
CREATE POLICY "Supervisores view notification_routes" 
ON public.notification_routes 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Gerentes view notification_settings" ON public.notification_settings;
CREATE POLICY "Supervisores view notification_settings" 
ON public.notification_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Gerentes view notification_source_config" ON public.notification_source_config;
CREATE POLICY "Supervisores view notification_source_config" 
ON public.notification_source_config 
FOR SELECT 
USING (has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Gerentes view knowledge_article_usage for manageable tickets" ON public.knowledge_article_usage;
CREATE POLICY "Supervisores view knowledge_article_usage for manageable tickets" 
ON public.knowledge_article_usage 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = knowledge_article_usage.ticket_id) AND public.can_update_ticket(t.unidade_id))));

DROP POLICY IF EXISTS "Gerentes can update messages for tickets in their units" ON public.ticket_mensagens;
CREATE POLICY "Supervisores can update messages for tickets in their units" 
ON public.ticket_mensagens 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_mensagens.ticket_id) AND can_update_ticket(t.unidade_id, t.equipe_responsavel_id))));

DROP POLICY IF EXISTS "Gerentes view crises_ativas for manageable tickets" ON public.crises_ativas;
CREATE POLICY "Supervisores view crises_ativas for manageable tickets" 
ON public.crises_ativas 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = crises_ativas.ticket_id) AND public.can_update_ticket(t.unidade_id))));

-- Atualizar função can_create_ticket para usar 'supervisor' ao invés de 'gerente'
CREATE OR REPLACE FUNCTION public.can_create_ticket(ticket_unidade_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    ) OR
    -- Allow creation if user profile exists (fallback for authenticated users)
    (
      auth.uid() IS NOT NULL AND
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
    )
$function$;

-- Atualizar função can_update_ticket para usar 'supervisor' ao invés de 'gerente'
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      EXISTS (
        SELECT 1
        FROM franqueados f
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
        AND f.unit_code ? ticket_unidade_id
      )
    ) OR
    (
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$function$;

-- Atualizar função get_unit_metrics para usar 'supervisor' ao invés de 'gerente'
CREATE OR REPLACE FUNCTION public.get_unit_metrics(p_user_id uuid, p_periodo_dias integer DEFAULT 30, p_equipe_filter text DEFAULT NULL::text)
 RETURNS TABLE(unidade_id text, unidade_nome text, total_tickets_mes bigint, tickets_resolvidos bigint, tickets_abertos bigint, percentual_sla numeric, tempo_medio_resolucao numeric, tickets_crise bigint, ia_bem_sucedida bigint)
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
      WHEN role = 'supervisor' THEN 3
      ELSE 4
    END
  LIMIT 1;

  -- Unidades acessíveis conforme papel
  IF user_role IN ('admin', 'diretoria') THEN
    accessible_units := ARRAY(SELECT id FROM public.unidades);
  ELSIF user_role = 'supervisor' THEN
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

-- Atualizar função get_realtime_kpis para usar 'supervisor' ao invés de 'gerente'
CREATE OR REPLACE FUNCTION public.get_realtime_kpis(p_user_id uuid DEFAULT NULL::uuid, p_unidade_filter text DEFAULT NULL::text, p_equipe_filter uuid DEFAULT NULL::uuid, p_periodo_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHEN role = 'supervisor' THEN 3
      ELSE 4
    END 
  LIMIT 1;

  -- Get accessible units based on role
  IF user_role IN ('admin', 'diretoria') THEN
    -- Full access
    accessible_units := ARRAY(SELECT id FROM public.unidades);
  ELSIF user_role = 'supervisor' THEN
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
$function$;

-- Atualizar função get_ticket_trends para usar 'supervisor' ao invés de 'gerente'
CREATE OR REPLACE FUNCTION public.get_ticket_trends(p_user_id uuid DEFAULT NULL::uuid, p_dias integer DEFAULT 30, p_unidade_filter text DEFAULT NULL::text)
 RETURNS TABLE(data date, total_tickets bigint, tickets_resolvidos bigint, tickets_sla_ok bigint, tempo_medio_resolucao numeric)
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
      WHEN role = 'supervisor' THEN 3
      ELSE 4
    END 
  LIMIT 1;

  IF user_role IN ('admin', 'diretoria') THEN
    accessible_units := ARRAY(SELECT id FROM public.unidades);
  ELSIF user_role = 'supervisor' THEN
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

-- Atualizar função auto_assign_franqueado_role para usar 'supervisor' ao invés de 'gerente'
CREATE OR REPLACE FUNCTION public.auto_assign_franqueado_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_user_id UUID;
BEGIN
  -- Buscar o user_id do profile baseado no email do franqueado
  SELECT id INTO profile_user_id 
  FROM public.profiles 
  WHERE email = NEW.email;
  
  -- Se encontrou o user_id, atribuir role de supervisor
  IF profile_user_id IS NOT NULL THEN
    -- Inserir role de supervisor (se não existir)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (profile_user_id, 'supervisor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log da ação
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'user_roles',
      profile_user_id::TEXT,
      'Role de supervisor atribuído automaticamente',
      NULL,
      NULL, NULL, NULL,
      NULL,
      jsonb_build_object('email', NEW.email, 'role', 'supervisor'),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$function$;