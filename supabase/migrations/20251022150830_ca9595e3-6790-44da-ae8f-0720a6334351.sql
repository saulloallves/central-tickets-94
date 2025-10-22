-- ============================================================================
-- SISTEMA DE ESCALONAMENTO SIMPLIFICADO USANDO NOTIFICATION_SOURCE_CONFIG
-- ============================================================================

-- 1. Recriar a função process_overdue_slas() para usar notification_source_config
DROP FUNCTION IF EXISTS process_overdue_slas();

CREATE OR REPLACE FUNCTION process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER := 0;
  notification_destination TEXT;
  v_ticket RECORD;
BEGIN
  -- 🔒 LOCK para prevenir race conditions
  LOCK TABLE notifications_queue IN EXCLUSIVE MODE;

  -- 🎯 Buscar o destino configurado para notificações de SLA vencido
  SELECT fixed_value INTO notification_destination
  FROM notification_source_config
  WHERE notification_type = 'sla_breach'
    AND is_active = true
    AND source_type = 'fixed'
  LIMIT 1;

  -- ⚠️ Se não encontrou destino configurado, abortar
  IF notification_destination IS NULL THEN
    RAISE WARNING 'Nenhum destino configurado para notificações de SLA vencido (notification_source_config)';
    RETURN 0;
  END IF;

  RAISE LOG 'Destino para SLA breach encontrado: %', notification_destination;

  -- 🔍 Processar tickets vencidos que ainda não foram escalonados
  FOR v_ticket IN
    SELECT 
      t.id,
      t.codigo_ticket,
      t.titulo,
      t.descricao_problema,
      t.sla_minutos_restantes,
      t.prioridade,
      t.unidade_id,
      t.status,
      u.grupo as unidade_nome,
      e.nome as equipe_nome
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_id = e.id
    WHERE t.status_sla = 'vencido'::ticket_sla_status
      AND t.status NOT IN ('concluido', 'escalonado')
      -- 🚫 Não processar se já existe notificação recente
      AND NOT EXISTS (
        SELECT 1 
        FROM notifications_queue nq 
        WHERE nq.ticket_id = t.id 
          AND nq.type = 'sla_breach'
          AND nq.status IN ('pending', 'processing', 'sent')
          AND nq.created_at > NOW() - INTERVAL '2 hours'
      )
  LOOP
    -- ✅ Atualizar status do ticket para 'escalonado'
    UPDATE tickets
    SET 
      status = 'escalonado',
      escalonado_para = notification_destination,
      escalonamento_nivel = 1,  -- Apenas 1 nível
      updated_at = NOW()
    WHERE id = v_ticket.id;

    -- ✅ Criar notificação com o destino correto
    INSERT INTO notifications_queue (type, ticket_id, payload, status)
    VALUES (
      'sla_breach',
      v_ticket.id,
      jsonb_build_object(
        'codigo_ticket', v_ticket.codigo_ticket,
        'titulo', v_ticket.titulo,
        'descricao_problema', COALESCE(LEFT(v_ticket.descricao_problema, 200), 'N/A'),
        'sla_minutos_restantes', v_ticket.sla_minutos_restantes,
        'prioridade', v_ticket.prioridade,
        'unidade_id', v_ticket.unidade_id,
        'unidade_nome', COALESCE(v_ticket.unidade_nome, 'N/A'),
        'equipe_responsavel', COALESCE(v_ticket.equipe_nome, 'Não atribuído'),
        'status', v_ticket.status,
        'destino_whatsapp', notification_destination,
        'escalado_para', notification_destination
      ),
      'pending'
    );

    affected_count := affected_count + 1;
    
    RAISE LOG 'Ticket % escalonado para %', v_ticket.codigo_ticket, notification_destination;
  END LOOP;
  
  RAISE LOG 'Total de tickets escalonados: %', affected_count;
  RETURN affected_count;
END;
$$;

-- 2. Atualizar trigger para não incrementar níveis desnecessários
DROP TRIGGER IF EXISTS auto_process_sla_on_update ON tickets;

CREATE OR REPLACE FUNCTION auto_process_sla_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ✅ Se o SLA acabou de vencer, apenas marcar como vencido
  -- O process_overdue_slas() cuidará do escalonamento
  IF NEW.status_sla = 'vencido' AND OLD.status_sla != 'vencido' THEN
    -- Apenas registrar que venceu
    NEW.sla_vencido_em := COALESCE(NEW.sla_vencido_em, NOW());
    
    RAISE LOG 'SLA vencido para ticket %: será processado pelo process_overdue_slas()', NEW.codigo_ticket;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_process_sla_on_update
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  WHEN (NEW.status_sla IS DISTINCT FROM OLD.status_sla)
  EXECUTE FUNCTION auto_process_sla_on_update();

-- 3. Garantir que existe configuração para sla_breach
DO $$
BEGIN
  -- Verificar se existe configuração ativa para sla_breach
  IF NOT EXISTS (
    SELECT 1 FROM notification_source_config
    WHERE notification_type = 'sla_breach' AND is_active = true
  ) THEN
    RAISE WARNING 'ATENÇÃO: Nenhuma configuração ativa encontrada para sla_breach em notification_source_config!';
    RAISE WARNING 'Configure o destino para notificações de SLA vencido no sistema.';
  END IF;
END $$;