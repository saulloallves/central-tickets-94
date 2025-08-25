-- Drop existing conflicting functions and recreate with correct signatures
DROP FUNCTION IF EXISTS public.get_unit_metrics(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.get_unit_metrics(uuid, integer, text);

-- Create the correct version of get_unit_metrics function
CREATE OR REPLACE FUNCTION public.get_unit_metrics(
  p_user_id UUID DEFAULT NULL,
  p_periodo_dias INTEGER DEFAULT 30,
  p_equipe_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  unidade_id TEXT,
  unidade_nome TEXT,
  total_tickets BIGINT,
  tickets_concluidos BIGINT,
  sla_percentage NUMERIC,
  tempo_medio_resolucao NUMERIC,
  tickets_crise BIGINT,
  taxa_resolucao NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.unidade_id,
    COALESCE(u.nome, t.unidade_id) as unidade_nome,
    COUNT(*)::BIGINT as total_tickets,
    COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::BIGINT as tickets_concluidos,
    ROUND(
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(CASE WHEN t.status_sla = 'dentro_prazo' AND t.status = 'concluido' THEN 1 END)::DECIMAL / COUNT(*)) * 100
        ELSE 0 
      END, 2
    ) as sla_percentage,
    ROUND(
      AVG(
        CASE 
          WHEN t.resolvido_em IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600.0 
        END
      )::NUMERIC, 2
    ) as tempo_medio_resolucao,
    COUNT(CASE WHEN t.prioridade = 'crise' THEN 1 END)::BIGINT as tickets_crise,
    ROUND(
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(CASE WHEN t.status = 'concluido' THEN 1 END)::DECIMAL / COUNT(*)) * 100
        ELSE 0 
      END, 2
    ) as taxa_resolucao
  FROM public.tickets t
  LEFT JOIN public.unidades u ON u.id = t.unidade_id
  WHERE t.data_abertura >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias
    AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id = p_equipe_filter)
    AND (
      p_user_id IS NULL 
      OR public.has_role(p_user_id, 'admin')
      OR public.can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
    )
  GROUP BY t.unidade_id, u.nome
  ORDER BY total_tickets DESC;
END;
$$;