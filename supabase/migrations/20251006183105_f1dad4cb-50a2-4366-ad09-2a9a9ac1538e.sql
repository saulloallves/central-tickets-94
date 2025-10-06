-- Fix all RPC functions to use UUID for unidade_filter parameter

-- Fix get_team_metrics function
CREATE OR REPLACE FUNCTION public.get_team_metrics(
  p_user_id uuid DEFAULT NULL::uuid,
  p_periodo_dias integer DEFAULT 30,
  p_unidade_filter uuid DEFAULT NULL::uuid  -- Changed from text to uuid
)
RETURNS TABLE(
  equipe_id uuid,
  equipe_nome text,
  total_tickets bigint,
  tickets_resolvidos bigint,
  tickets_em_aberto bigint,
  tempo_medio_resolucao numeric,
  taxa_resolucao numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as equipe_id,
    e.nome as equipe_nome,
    COUNT(t.id) as total_tickets,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END) as tickets_resolvidos,
    COUNT(CASE WHEN t.status IN ('aberto', 'em_atendimento') THEN 1 END) as tickets_em_aberto,
    ROUND(AVG(
      CASE 
        WHEN t.resolvido_em IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
      END
    )::numeric, 2) as tempo_medio_resolucao,
    CASE 
      WHEN COUNT(t.id) > 0 THEN 
        ROUND((COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::decimal / COUNT(t.id)) * 100, 2)
      ELSE 0 
    END as taxa_resolucao
  FROM public.equipes e
  LEFT JOIN public.tickets t ON t.equipe_responsavel_id = e.id
    AND t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
    AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
  WHERE e.ativo = true
  GROUP BY e.id, e.nome
  ORDER BY total_tickets DESC;
END;
$function$;

-- Fix get_ticket_trends function  
CREATE OR REPLACE FUNCTION public.get_ticket_trends(
  p_user_id uuid DEFAULT NULL::uuid,
  p_dias integer DEFAULT 7,
  p_unidade_filter uuid DEFAULT NULL::uuid  -- Changed from text to uuid
)
RETURNS TABLE(
  data date,
  tickets_resolvidos bigint,
  tickets_sla_ok bigint,
  tempo_medio_resolucao numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(t.data_abertura) as data,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END) as tickets_resolvidos,
    COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END) as tickets_sla_ok,
    ROUND(AVG(
      CASE 
        WHEN t.resolvido_em IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
      END
    )::numeric, 2) as tempo_medio_resolucao
  FROM public.tickets t
  WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_dias
    AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
  GROUP BY DATE(t.data_abertura)
  ORDER BY data DESC;
END;
$function$;