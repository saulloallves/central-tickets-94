-- Fix get_unit_metrics function to remove non-existent columns and fix status enums
CREATE OR REPLACE FUNCTION public.get_unit_metrics(p_user_id uuid DEFAULT NULL::uuid, p_periodo_dias integer DEFAULT 30)
 RETURNS TABLE(
   unidade_id text,
   unidade_nome text, 
   total_tickets bigint,
   tickets_resolvidos bigint,
   tickets_abertos bigint,
   percentual_sla numeric,
   tempo_medio_resolucao numeric,
   tickets_crise bigint,
   tickets_sucesso bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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

  RETURN QUERY
  SELECT 
    t.unidade_id,
    t.unidade_id as unidade_nome, -- Using unidade_id as name since unidades.nome doesn't exist
    COUNT(*)::BIGINT as total_tickets,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT as tickets_resolvidos,
    COUNT(CASE WHEN t.status IN ('aberto', 'em_atendimento', 'aguardando_retorno', 'escalonado') THEN 1 END)::BIGINT as tickets_abertos,
    ROUND(
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::DECIMAL / COUNT(*)) * 100
        ELSE 0 
      END, 2
    ) as percentual_sla,
    ROUND(
      AVG(CASE 
        WHEN t.resolvido_em IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
      END)::NUMERIC, 2
    ) as tempo_medio_resolucao,
    COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END)::BIGINT as tickets_crise,
    COUNT(CASE WHEN t.status = 'concluido' AND t.status_sla = 'dentro_prazo' THEN 1 END)::BIGINT as tickets_sucesso
  FROM public.tickets t
  WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
  AND (accessible_units IS NULL OR t.unidade_id = ANY(accessible_units))
  GROUP BY t.unidade_id
  ORDER BY total_tickets DESC;
END;
$function$