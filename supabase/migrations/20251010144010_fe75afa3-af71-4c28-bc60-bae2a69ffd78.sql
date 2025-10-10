-- Fix get_unit_metrics to match TypeScript expected structure
DROP FUNCTION IF EXISTS get_unit_metrics(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION public.get_unit_metrics(
  p_user_id UUID DEFAULT NULL,
  p_periodo_dias INTEGER DEFAULT 30,
  p_equipe_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  unidade_id UUID,
  unidade_nome TEXT,
  total_tickets_mes BIGINT,
  tickets_resolvidos BIGINT,
  tickets_abertos BIGINT,
  percentual_sla NUMERIC,
  tempo_medio_resolucao NUMERIC,
  tickets_crise BIGINT,
  ia_bem_sucedida BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as unidade_id,
    u.grupo as unidade_nome,
    COUNT(t.id)::BIGINT as total_tickets_mes,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT as tickets_resolvidos,
    (COUNT(t.id) - COUNT(CASE WHEN t.status = 'concluido' THEN 1 END))::BIGINT as tickets_abertos,
    ROUND(
      CASE 
        WHEN COUNT(t.id) > 0 THEN 
          (COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::DECIMAL / COUNT(t.id)) * 100
        ELSE 0 
      END, 2
    ) as percentual_sla,
    ROUND(
      AVG(
        CASE 
          WHEN t.resolvido_em IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
        END
      )::NUMERIC, 2
    ) as tempo_medio_resolucao,
    COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END)::BIGINT as tickets_crise,
    0::BIGINT as ia_bem_sucedida
  FROM public.unidades u
  LEFT JOIN public.tickets t ON t.unidade_id = u.id 
    AND t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
    AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id = p_equipe_filter)
  WHERE (
    p_user_id IS NULL 
    OR public.has_role(p_user_id, 'admin')
    OR public.can_view_ticket(u.id, t.equipe_responsavel_id)
  )
  GROUP BY u.id, u.grupo
  HAVING COUNT(t.id) > 0
  ORDER BY total_tickets_mes DESC;
END;
$$;