-- Fix get_unit_metrics function with correct column references
DROP FUNCTION IF EXISTS get_unit_metrics(uuid, integer, text);

CREATE OR REPLACE FUNCTION get_unit_metrics(
    p_user_id UUID,
    p_periodo_dias INTEGER DEFAULT 30,
    p_equipe_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
    unidade_id TEXT,
    unidade_nome TEXT,
    total_tickets_mes INTEGER,
    tickets_resolvidos INTEGER,
    tickets_sla_ok INTEGER,
    tickets_abertos INTEGER,
    tickets_crise INTEGER,
    tempo_medio_resolucao NUMERIC,
    interacoes_ia_total INTEGER,
    ia_bem_sucedida INTEGER,
    percentual_sla NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has proper permissions
    IF NOT (
        has_role(p_user_id, 'admin'::app_role) OR 
        has_role(p_user_id, 'diretoria'::app_role) OR 
        has_role(p_user_id, 'gerente'::app_role)
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin, Diretoria or Gerente role required.';
    END IF;

    RETURN QUERY
    WITH unit_data AS (
        SELECT 
            t.unidade_id,
            COALESCE(unidades.nome, t.unidade_id) as unit_name,
            COUNT(*) as total_tickets,
            COUNT(CASE WHEN t.status IN ('resolvido', 'fechado') THEN 1 END) as resolved_tickets,
            COUNT(CASE WHEN t.status_sla = 'dentro_prazo' THEN 1 END) as sla_ok_tickets,
            COUNT(CASE WHEN t.status IN ('aberto', 'em_andamento', 'aguardando') THEN 1 END) as open_tickets,
            COUNT(CASE WHEN EXISTS(SELECT 1 FROM crises_ativas ca WHERE ca.ticket_id = t.id AND ca.resolvida_em IS NULL) THEN 1 END) as crisis_tickets,
            COALESCE(AVG(CASE 
                WHEN t.resolvido_em IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600 
            END), 0) as avg_resolution_time,
            COUNT(CASE WHEN EXISTS(SELECT 1 FROM ticket_ai_interactions tai WHERE tai.ticket_id = t.id) THEN 1 END) as ai_interactions,
            COUNT(CASE WHEN EXISTS(SELECT 1 FROM ticket_ai_interactions tai WHERE tai.ticket_id = t.id AND tai.foi_usada = true) THEN 1 END) as successful_ai
        FROM tickets t
        LEFT JOIN unidades ON unidades.id = t.unidade_id
        WHERE t.data_abertura >= (CURRENT_DATE - INTERVAL '%s days')
            AND (p_equipe_filter IS NULL OR t.equipe_responsavel_id::text = p_equipe_filter)
            AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
        GROUP BY t.unidade_id, unidades.nome
    )
    SELECT 
        ud.unidade_id,
        ud.unit_name,
        ud.total_tickets::INTEGER,
        ud.resolved_tickets::INTEGER,
        ud.sla_ok_tickets::INTEGER,
        ud.open_tickets::INTEGER,
        ud.crisis_tickets::INTEGER,
        ROUND(ud.avg_resolution_time, 2) as tempo_medio_resolucao,
        ud.ai_interactions::INTEGER,
        ud.successful_ai::INTEGER,
        CASE 
            WHEN ud.total_tickets > 0 
            THEN ROUND((ud.sla_ok_tickets::NUMERIC / ud.total_tickets::NUMERIC) * 100, 2)
            ELSE 0 
        END as percentual_sla
    FROM unit_data ud
    ORDER BY ud.total_tickets DESC;
END;
$$;