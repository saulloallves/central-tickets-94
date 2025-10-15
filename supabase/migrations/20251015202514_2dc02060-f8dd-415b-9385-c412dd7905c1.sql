-- =============================================
-- CORREÇÃO: Enriquecer payload das notificações de SLA
-- =============================================

-- 1. Remover funções antigas para recriar com novo retorno
DROP FUNCTION IF EXISTS process_overdue_slas();
DROP FUNCTION IF EXISTS process_sla_half_warnings();

-- 2. Criar process_overdue_slas com dados completos do ticket
CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tickets_processados INTEGER := 0;
  v_ticket RECORD;
BEGIN
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.descricao_problema,
      t.prioridade,
      t.categoria,
      t.status,
      t.data_abertura,
      t.data_limite_sla,
      t.sla_minutos_restantes,
      t.sla_minutos_totais,
      t.unidade_id,
      t.equipe_responsavel_id,
      t.criado_por,
      u.grupo as unidade_nome,
      u.codigo_grupo,
      u.whatsapp_group_id,
      e.nome as equipe_nome,
      p.nome_completo as criador_nome
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    LEFT JOIN profiles p ON t.criado_por = p.id
    WHERE t.status IN ('aberto', 'em_atendimento', 'escalonado')
      AND t.sla_minutos_restantes IS NOT NULL
      AND t.sla_minutos_restantes <= 0
      AND t.status_sla != 'vencido'
      AND t.sla_pausado = FALSE
      AND t.sla_pausado_mensagem = FALSE
  LOOP
    UPDATE tickets
    SET status_sla = 'vencido'::sla_status,
        updated_at = NOW()
    WHERE id = v_ticket.id;
    
    INSERT INTO notifications_queue (
      ticket_id,
      type,
      alert_level,
      payload,
      status,
      sent_to_whatsapp
    ) VALUES (
      v_ticket.id,
      'sla_breach',
      'critical',
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'titulo_ticket', v_ticket.titulo,
        'descricao_problema', v_ticket.descricao_problema,
        'prioridade', v_ticket.prioridade,
        'categoria', v_ticket.categoria,
        'status', v_ticket.status,
        'data_abertura', v_ticket.data_abertura,
        'data_limite_sla', v_ticket.data_limite_sla,
        'minutos_vencidos', ABS(v_ticket.sla_minutos_restantes),
        'sla_total_minutos', v_ticket.sla_minutos_totais,
        'unidade_id', v_ticket.unidade_id,
        'unidade_nome', v_ticket.unidade_nome,
        'codigo_grupo', v_ticket.codigo_grupo,
        'whatsapp_group_id', v_ticket.whatsapp_group_id,
        'equipe_responsavel_id', v_ticket.equipe_responsavel_id,
        'equipe_responsavel', v_ticket.equipe_nome,
        'criado_por', v_ticket.criado_por,
        'criador_nome', v_ticket.criador_nome,
        'timestamp', NOW()
      ),
      'pending',
      false
    )
    ON CONFLICT (ticket_id, type) 
    WHERE type IN ('sla_breach')
    DO UPDATE SET
      payload = EXCLUDED.payload,
      status = 'pending',
      sent_to_whatsapp = false,
      created_at = NOW();
    
    v_tickets_processados := v_tickets_processados + 1;
    
    PERFORM log_sla_action(
      v_ticket.id,
      'SLA vencido - notificação criada',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'minutos_vencidos', ABS(v_ticket.sla_minutos_restantes)
      )
    );
  END LOOP;
  
  RETURN v_tickets_processados;
END;
$$;

-- 3. Criar process_sla_half_warnings com dados completos
CREATE OR REPLACE FUNCTION process_sla_half_warnings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notificacoes_criadas INTEGER := 0;
  v_ticket RECORD;
BEGIN
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.descricao_problema,
      t.prioridade,
      t.categoria,
      t.status,
      t.data_abertura,
      t.data_limite_sla,
      t.sla_minutos_restantes,
      t.sla_minutos_totais,
      t.unidade_id,
      t.equipe_responsavel_id,
      t.criado_por,
      u.grupo as unidade_nome,
      u.codigo_grupo,
      u.whatsapp_group_id,
      e.nome as equipe_nome,
      p.nome_completo as criador_nome,
      CASE 
        WHEN t.sla_minutos_totais > 0 THEN 
          (t.sla_minutos_restantes::NUMERIC / t.sla_minutos_totais::NUMERIC) * 100
        ELSE 0 
      END as percentual_restante
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    LEFT JOIN profiles p ON t.criado_por = p.id
    WHERE t.status IN ('aberto', 'em_atendimento', 'escalonado')
      AND t.sla_minutos_totais > 0
      AND t.sla_minutos_restantes > 0
      AND t.sla_pausado = FALSE
      AND t.sla_pausado_mensagem = FALSE
      AND (t.sla_minutos_restantes::NUMERIC / t.sla_minutos_totais::NUMERIC) <= 0.5
      AND NOT EXISTS (
        SELECT 1 FROM notifications_queue nq
        WHERE nq.ticket_id = t.id 
        AND nq.type = 'sla_half'
        AND nq.status IN ('pending', 'processing', 'sent')
      )
  LOOP
    INSERT INTO notifications_queue (
      ticket_id,
      type,
      alert_level,
      payload,
      status,
      sent_to_whatsapp
    ) VALUES (
      v_ticket.id,
      'sla_half',
      'high',
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'codigo_ticket', v_ticket.codigo_ticket,
        'titulo_ticket', v_ticket.titulo,
        'descricao_problema', v_ticket.descricao_problema,
        'prioridade', v_ticket.prioridade,
        'categoria', v_ticket.categoria,
        'status', v_ticket.status,
        'data_abertura', v_ticket.data_abertura,
        'data_limite_sla', v_ticket.data_limite_sla,
        'minutos_restantes', v_ticket.sla_minutos_restantes,
        'sla_total_minutos', v_ticket.sla_minutos_totais,
        'percentual_restante', ROUND(v_ticket.percentual_restante, 1),
        'unidade_id', v_ticket.unidade_id,
        'unidade_nome', v_ticket.unidade_nome,
        'codigo_grupo', v_ticket.codigo_grupo,
        'whatsapp_group_id', v_ticket.whatsapp_group_id,
        'equipe_responsavel_id', v_ticket.equipe_responsavel_id,
        'equipe_responsavel', v_ticket.equipe_nome,
        'criado_por', v_ticket.criado_por,
        'criador_nome', v_ticket.criador_nome,
        'timestamp', NOW()
      ),
      'pending',
      false
    );
    
    v_notificacoes_criadas := v_notificacoes_criadas + 1;
    
    PERFORM log_sla_action(
      v_ticket.id,
      'Alerta 50% SLA - notificação criada',
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'percentual_restante', ROUND(v_ticket.percentual_restante, 1)
      )
    );
  END LOOP;
  
  RETURN v_notificacoes_criadas;
END;
$$;