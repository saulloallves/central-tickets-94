-- Corrigir a função get_team_metrics para usar a coluna status_sla correta
CREATE OR REPLACE FUNCTION public.get_team_metrics(
  p_user_id UUID,
  p_periodo_dias INTEGER DEFAULT 30,
  p_unidade_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  equipe_id UUID,
  equipe_nome TEXT,
  total_tickets BIGINT,
  tickets_resolvidos BIGINT,
  tickets_sla_ok BIGINT,
  tempo_medio_resolucao NUMERIC,
  tickets_crise BIGINT,
  tickets_reabertos BIGINT,
  unidades_atendidas BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has permission to view tickets
  IF NOT (
    has_role(p_user_id, 'admin'::app_role) OR 
    has_role(p_user_id, 'diretoria'::app_role) OR
    has_role(p_user_id, 'supervisor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Acesso negado. Usuário não tem permissão para visualizar métricas das equipes.';
  END IF;

  RETURN QUERY
  WITH filtered_tickets AS (
    SELECT t.*
    FROM tickets t
    WHERE 
      (p_periodo_dias = 0 OR t.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias)
      AND (p_unidade_filter IS NULL OR t.unidade_id::text = p_unidade_filter)
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
    COUNT(ft.id) FILTER (WHERE ft.status = 'concluido')::bigint as tickets_resolvidos,
    COUNT(ft.id) FILTER (WHERE ft.status_sla = 'dentro_prazo')::bigint as tickets_sla_ok,
    COALESCE(AVG(
      CASE 
        WHEN ft.status = 'concluido' AND ft.atendimento_iniciado_em IS NOT NULL AND ft.resolvido_em IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ft.resolvido_em - ft.atendimento_iniciado_em))/3600 
      END
    ), 0)::numeric as tempo_medio_resolucao,
    COUNT(ft.id) FILTER (WHERE ft.prioridade = 'crise')::bigint as tickets_crise,
    COUNT(ft.id) FILTER (WHERE ft.reaberto_count > 0)::bigint as tickets_reabertos,
    COUNT(DISTINCT ft.unidade_id)::bigint as unidades_atendidas
  FROM filtered_tickets ft
  LEFT JOIN equipes e ON e.id = ft.equipe_responsavel_id
  GROUP BY e.id, e.nome
  ORDER BY total_tickets DESC;
END;
$$;