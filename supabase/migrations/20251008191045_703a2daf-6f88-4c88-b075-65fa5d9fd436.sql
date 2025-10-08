-- Fix column reference in notification triggers - unidades.grupo instead of unidades.nome

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.create_internal_notification_on_ticket_created() CASCADE;
DROP FUNCTION IF EXISTS public.create_internal_notification_on_sla_breach() CASCADE;
DROP FUNCTION IF EXISTS public.create_internal_notification_on_sla_half() CASCADE;

-- Recreate function for ticket created notifications (FIXED: u.grupo instead of u.nome)
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_ticket_created()
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
  IF NEW.type = 'ticket_created' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket (FIXED: u.grupo instead of u.nome)
    SELECT t.*, u.grupo as unidade_nome, e.nome as equipe_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      v_notification_title := 'Novo Ticket: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
      v_notification_message := 'Ticket criado: ' || COALESCE(v_ticket.titulo, 'Sem título') || 
                                ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
                                ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
      
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
          'equipe_id', v_ticket.equipe_responsavel_id
        )
      )
      RETURNING id INTO v_notification_id;
      
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate function for SLA breach notifications (FIXED: u.grupo instead of u.nome)
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_sla_breach()
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
  IF NEW.type = 'sla_breach' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket (FIXED: u.grupo instead of u.nome)
    SELECT t.*, u.grupo as unidade_nome, e.nome as equipe_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      v_notification_title := '⚠️ SLA VENCIDO: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
      v_notification_message := 'O SLA do ticket foi ultrapassado! ' || 
                                COALESCE(v_ticket.titulo, 'Sem título') || 
                                ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
                                ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
      
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

-- Recreate function for SLA half notifications (FIXED: u.grupo instead of u.nome)
CREATE OR REPLACE FUNCTION public.create_internal_notification_on_sla_half()
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
  IF NEW.type = 'sla_half' AND NEW.status = 'pending' THEN
    
    -- Buscar dados do ticket (FIXED: u.grupo instead of u.nome)
    SELECT t.*, u.grupo as unidade_nome, e.nome as equipe_nome
    INTO v_ticket
    FROM tickets t
    LEFT JOIN unidades u ON t.unidade_id = u.id
    LEFT JOIN equipes e ON t.equipe_responsavel_id = e.id
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket.id IS NOT NULL THEN
      v_notification_title := '⏰ Alerta SLA 50%: ' || COALESCE(v_ticket.codigo_ticket, 'Sem código');
      v_notification_message := '50% do SLA já passou! ' || 
                                COALESCE(v_ticket.titulo, 'Sem título') || 
                                ' - Unidade: ' || COALESCE(v_ticket.unidade_nome, 'N/A') ||
                                ' - Prioridade: ' || COALESCE(v_ticket.prioridade::text, 'N/A');
      
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
        'sla_half',
        v_ticket.id,
        jsonb_build_object(
          'ticket_id', v_ticket.id,
          'codigo_ticket', v_ticket.codigo_ticket,
          'alert_level', 'warning'
        )
      )
      RETURNING id INTO v_notification_id;
      
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;