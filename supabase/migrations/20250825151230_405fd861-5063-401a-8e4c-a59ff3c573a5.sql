-- Atualizar as funções que ainda têm valores de enum incorretos de ticket_status
-- A função get_team_metrics está usando "resolvido" mas deveria usar "concluido"

CREATE OR REPLACE FUNCTION public.get_team_metrics(p_user_id uuid, p_periodo_dias integer, p_unidade_filter text)
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
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(p_user_id, 'admin'::app_role) OR 
    has_role(p_user_id, 'diretoria'::app_role) OR
    has_role(p_user_id, 'supervisor'::app_role) OR
    has_role(p_user_id, 'diretor'::app_role) OR
    has_role(p_user_id, 'colaborador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para acessar métricas das equipes';
  END IF;

  RETURN QUERY
  WITH filtered_tickets AS (
    SELECT t.*
    FROM tickets t
    WHERE 
      (p_periodo_dias = 0 OR t.created_at >= CURRENT_DATE - INTERVAL '1 day' * p_periodo_dias)
      AND (p_unidade_filter IS NULL OR t.unidade_id = p_unidade_filter)
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
    COUNT(ft.id) FILTER (WHERE ft.status = 'concluido')::bigint as tickets_resolvidos,  -- Corrigido de 'resolvido' para 'concluido'
    COUNT(ft.id) FILTER (WHERE ft.sla_status = 'dentro_prazo')::bigint as tickets_sla_ok,
    COALESCE(AVG(
      CASE 
        WHEN ft.status = 'concluido' AND ft.atendimento_iniciado_em IS NOT NULL AND ft.resolvido_em IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ft.resolvido_em - ft.atendimento_iniciado_em))/3600 
      END
    ), 0)::numeric as tempo_medio_resolucao,
    COUNT(ft.id) FILTER (WHERE ft.prioridade = 'crise')::bigint as tickets_crise,  -- Corrigido de 'crítica' para 'crise'
    COUNT(ft.id) FILTER (WHERE ft.reabertura_count > 0)::bigint as tickets_reabertos,
    COUNT(DISTINCT ft.unidade_id)::bigint as unidades_atendidas
  FROM filtered_tickets ft
  LEFT JOIN equipes e ON e.id = ft.equipe_responsavel_id
  GROUP BY e.id, e.nome
  ORDER BY total_tickets DESC;
END;
$$;