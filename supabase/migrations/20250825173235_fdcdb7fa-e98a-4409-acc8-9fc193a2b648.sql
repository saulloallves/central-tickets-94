-- Recreate necessary functions for dashboard functionality
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Check if user has permission through role
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id 
    AND rp.permission = _permission
  ) OR EXISTS (
    -- Check if user has direct permission that hasn't expired
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = _user_id 
    AND up.permission = _permission
    AND (up.expires_at IS NULL OR up.expires_at > now())
  )
$function$;

-- Function to check ticket access 
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'diretoria'::app_role) OR
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

-- Function to check if user is active member of team
CREATE OR REPLACE FUNCTION public.is_active_member_of_equipe(_user_id uuid, _equipe_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.equipe_members em
    WHERE em.user_id = _user_id 
    AND em.equipe_id = _equipe_id
    AND em.ativo = true
  )
$function$;

-- Function to get ticket trends
CREATE OR REPLACE FUNCTION public.get_ticket_trends(p_user_id uuid DEFAULT NULL::uuid, p_dias integer DEFAULT 30, p_unidade_filter text DEFAULT NULL::text)
 RETURNS TABLE(
   data text,
   total_tickets bigint,
   tickets_resolvidos bigint,
   tickets_sla_ok bigint,
   tempo_medio_resolucao numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  effective_user_id UUID;
  user_role TEXT;
  accessible_units TEXT[];
BEGIN
  effective_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Get user role and accessible units (similar logic to get_realtime_kpis)
  IF effective_user_id IS NOT NULL THEN
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

    IF user_role IN ('admin', 'diretoria') THEN
      accessible_units := ARRAY(SELECT id FROM public.unidades);
    ELSIF user_role = 'supervisor' THEN
      SELECT ARRAY_AGG(u.id) INTO accessible_units
      FROM public.unidades u
      JOIN public.franqueados f ON f.unit_code ? u.id
      JOIN public.profiles p ON p.email = f.email
      WHERE p.id = effective_user_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    to_char(t.data_abertura, 'YYYY-MM-DD') as data,
    COUNT(t.id) as total_tickets,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END) as tickets_resolvidos,
    COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END) as tickets_sla_ok,
    ROUND(AVG(CASE 
      WHEN t.resolvido_em IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
    END)::NUMERIC, 2) as tempo_medio_resolucao
  FROM public.tickets t
  WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * COALESCE(p_dias, 30)
    AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
    AND (accessible_units IS NULL OR t.unidade_id = ANY(accessible_units))
  GROUP BY to_char(t.data_abertura, 'YYYY-MM-DD')
  ORDER BY data DESC
  LIMIT 30;
END;
$function$;