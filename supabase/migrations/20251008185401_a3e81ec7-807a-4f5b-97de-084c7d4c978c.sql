-- Função para criar notificação interna quando ticket é criado
CREATE OR REPLACE FUNCTION create_internal_notification_on_ticket_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_notification_id uuid;
  v_member record;
  v_notification_title text;
  v_notification_message text;
BEGIN
  -- Apenas processar notificações do tipo ticket_created que estão pending
  IF NEW.type = 'ticket_created' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket
    SELECT t.*, u.nome as unidade_nome, e.nome as equipe_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Criar título e mensagem da notificação
      v_notification_title := 'Novo Ticket: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
      v_notification_message := 'Ticket criado: ' || COALESCE(v_ticket.titulo, 'Sem título') || 
                                ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
                                ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
      
      -- Criar notificação interna
      INSERT INTO internal_notifications (
        title,
        message,
        type,
        related_ticket_id,
        payload
      )
      VALUES (
        v_notification_title,
        v_notification_message,
        'ticket_created',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'prioridade', v_ticket.prioridade,
          'categoria', v_ticket.categoria,
          'unidade_id', v_ticket.unidade_id
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Notificar membros da equipe responsável (se houver)
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        FOR v_member IN
          SELECT DISTINCT user_id
          FROM equipe_members
          WHERE equipe_id = v_ticket.equipe_responsavel_id
            AND ativo = true
        LOOP
          INSERT INTO internal_notification_recipients (notification_id, user_id)
          VALUES (v_notification_id, v_member.user_id)
          ON CONFLICT (notification_id, user_id) DO NOTHING;
        END LOOP;
      ELSE
        -- Se não tem equipe, notificar admins e diretoria
        FOR v_member IN
          SELECT DISTINCT user_id
          FROM user_roles
          WHERE role IN ('admin', 'diretoria')
            AND approved = true
        LOOP
          INSERT INTO internal_notification_recipients (notification_id, user_id)
          VALUES (v_notification_id, v_member.user_id)
          ON CONFLICT (notification_id, user_id) DO NOTHING;
        END LOOP;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para criar notificação interna quando ticket é atribuído
CREATE OR REPLACE FUNCTION create_internal_notification_on_ticket_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_notification_id uuid;
  v_notification_title text;
  v_notification_message text;
  v_assigned_user_id uuid;
BEGIN
  -- Apenas processar notificações do tipo ticket_assigned que estão pending
  IF NEW.type = 'ticket_assigned' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket
    SELECT t.*, u.nome as unidade_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Extrair user_id do payload
      v_assigned_user_id := (NEW.payload->>'assigned_to')::uuid;
      
      IF v_assigned_user_id IS NOT NULL THEN
        -- Criar título e mensagem da notificação
        v_notification_title := 'Ticket Atribuído: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
        v_notification_message := 'Você recebeu um novo ticket: ' || COALESCE(v_ticket.titulo, 'Sem título') || 
                                  ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
                                  ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
        
        -- Criar notificação interna
        INSERT INTO internal_notifications (
          title,
          message,
          type,
          related_ticket_id,
          payload
        )
        VALUES (
          v_notification_title,
          v_notification_message,
          'ticket_assigned',
          v_ticket.id,
          jsonb_build_object(
            'ticket_id', v_ticket.id,
            'codigo_ticket', v_ticket.codigo_ticket,
            'assigned_to', v_assigned_user_id
          )
        )
        RETURNING id INTO v_notification_id;
        
        -- Notificar apenas o usuário atribuído
        INSERT INTO internal_notification_recipients (notification_id, user_id)
        VALUES (v_notification_id, v_assigned_user_id)
        ON CONFLICT (notification_id, user_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para criar notificação interna quando SLA é quebrado
CREATE OR REPLACE FUNCTION create_internal_notification_on_sla_breach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_notification_id uuid;
  v_member record;
  v_notification_title text;
  v_notification_message text;
BEGIN
  -- Apenas processar notificações do tipo sla_breach que estão pending
  IF NEW.type = 'sla_breach' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket
    SELECT t.*, u.nome as unidade_nome, e.nome as equipe_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Criar título e mensagem da notificação
      v_notification_title := '⚠️ SLA VENCIDO: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
      v_notification_message := 'O SLA do ticket foi ultrapassado! ' || 
                                COALESCE(v_ticket.titulo, 'Sem título') || 
                                ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
                                ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
      
      -- Criar notificação interna
      INSERT INTO internal_notifications (
        title,
        message,
        type,
        related_ticket_id,
        payload
      )
      VALUES (
        v_notification_title,
        v_notification_message,
        'sla_breach',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'alert_level', 'critical'
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Notificar equipe responsável + admins + diretoria (alta prioridade)
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        FOR v_member IN
          SELECT DISTINCT user_id
          FROM equipe_members
          WHERE equipe_id = v_ticket.equipe_responsavel_id
            AND ativo = true
        LOOP
          INSERT INTO internal_notification_recipients (notification_id, user_id)
          VALUES (v_notification_id, v_member.user_id)
          ON CONFLICT (notification_id, user_id) DO NOTHING;
        END LOOP;
      END IF;
      
      -- Sempre notificar admins e diretoria em SLA breach
      FOR v_member IN
        SELECT DISTINCT user_id
        FROM user_roles
        WHERE role IN ('admin', 'diretoria')
          AND approved = true
      LOOP
        INSERT INTO internal_notification_recipients (notification_id, user_id)
        VALUES (v_notification_id, v_member.user_id)
        ON CONFLICT (notification_id, user_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para criar notificação interna quando SLA está em 50%
CREATE OR REPLACE FUNCTION create_internal_notification_on_sla_half()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_notification_id uuid;
  v_member record;
  v_notification_title text;
  v_notification_message text;
BEGIN
  -- Apenas processar notificações do tipo sla_half que estão pending
  IF NEW.type = 'sla_half' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket
    SELECT t.*, u.nome as unidade_nome, e.nome as equipe_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      -- Criar título e mensagem da notificação
      v_notification_title := '⏰ Alerta SLA 50%: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
      v_notification_message := 'O ticket atingiu 50% do SLA! ' || 
                                COALESCE(v_ticket.titulo, 'Sem título') || 
                                ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A');
      
      -- Criar notificação interna
      INSERT INTO internal_notifications (
        title,
        message,
        type,
        related_ticket_id,
        payload
      )
      VALUES (
        v_notification_title,
        v_notification_message,
        'sla_warning',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'alert_level', 'warning'
        )
      )
      RETURNING id INTO v_notification_id;
      
      -- Notificar equipe responsável
      IF v_ticket.equipe_responsavel_id IS NOT NULL THEN
        FOR v_member IN
          SELECT DISTINCT user_id
          FROM equipe_members
          WHERE equipe_id = v_ticket.equipe_responsavel_id
            AND ativo = true
        LOOP
          INSERT INTO internal_notification_recipients (notification_id, user_id)
          VALUES (v_notification_id, v_member.user_id)
          ON CONFLICT (notification_id, user_id) DO NOTHING;
        END LOOP;
      ELSE
        -- Se não tem equipe, notificar admins
        FOR v_member IN
          SELECT DISTINCT user_id
          FROM user_roles
          WHERE role IN ('admin', 'diretoria')
            AND approved = true
        LOOP
          INSERT INTO internal_notification_recipients (notification_id, user_id)
          VALUES (v_notification_id, v_member.user_id)
          ON CONFLICT (notification_id, user_id) DO NOTHING;
        END LOOP;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar triggers para cada tipo de notificação
DROP TRIGGER IF EXISTS trigger_create_internal_notification_ticket_created ON notifications_queue;
CREATE TRIGGER trigger_create_internal_notification_ticket_created
  AFTER INSERT ON notifications_queue
  FOR EACH ROW
  WHEN (NEW.type = 'ticket_created' AND NEW.status = 'pending')
  EXECUTE FUNCTION create_internal_notification_on_ticket_created();

DROP TRIGGER IF EXISTS trigger_create_internal_notification_ticket_assigned ON notifications_queue;
CREATE TRIGGER trigger_create_internal_notification_ticket_assigned
  AFTER INSERT ON notifications_queue
  FOR EACH ROW
  WHEN (NEW.type = 'ticket_assigned' AND NEW.status = 'pending')
  EXECUTE FUNCTION create_internal_notification_on_ticket_assigned();

DROP TRIGGER IF EXISTS trigger_create_internal_notification_sla_breach ON notifications_queue;
CREATE TRIGGER trigger_create_internal_notification_sla_breach
  AFTER INSERT ON notifications_queue
  FOR EACH ROW
  WHEN (NEW.type = 'sla_breach' AND NEW.status = 'pending')
  EXECUTE FUNCTION create_internal_notification_on_sla_breach();

DROP TRIGGER IF EXISTS trigger_create_internal_notification_sla_half ON notifications_queue;
CREATE TRIGGER trigger_create_internal_notification_sla_half
  AFTER INSERT ON notifications_queue
  FOR EACH ROW
  WHEN (NEW.type = 'sla_half' AND NEW.status = 'pending')
  EXECUTE FUNCTION create_internal_notification_on_sla_half();