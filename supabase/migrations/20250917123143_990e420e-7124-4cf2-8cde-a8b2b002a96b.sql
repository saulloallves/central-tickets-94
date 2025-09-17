-- Criar rotas de notificação para SLA se não existirem
INSERT INTO public.notification_routes (type, destination_value, priority, is_active, description)
VALUES 
  ('sla_breach', '5511977256029', 1, true, 'Notificação de SLA vencido para número principal'),
  ('sla_half', '5511977256029', 2, true, 'Notificação de 50% do SLA para número principal')
ON CONFLICT (type, destination_value) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description;

-- Melhorar função de log do sistema SLA
CREATE OR REPLACE FUNCTION public.log_sla_action(
  p_ticket_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.logs_de_sistema (
    tipo_log,
    entidade_afetada,
    entidade_id,
    acao_realizada,
    dados_novos,
    canal
  ) VALUES (
    'sistema'::public.log_tipo,
    'tickets_sla',
    p_ticket_id::TEXT,
    p_action,
    p_details,
    'web'::public.log_canal
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Atualizar trigger de tickets para melhor logging de SLA
CREATE OR REPLACE FUNCTION public.tickets_sla_monitor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se o SLA mudou para vencido, escalar automaticamente
  IF NEW.status_sla = 'vencido' AND OLD.status_sla != 'vencido' THEN
    -- Escalar ticket se não estiver já escalonado ou concluído
    IF NEW.status NOT IN ('escalonado', 'concluido') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Log da escalação automática
      PERFORM public.log_sla_action(
        NEW.id,
        'SLA vencido - Ticket escalonado automaticamente',
        jsonb_build_object(
          'sla_vencido_em', NEW.data_limite_sla,
          'escalonamento_nivel', NEW.escalonamento_nivel,
          'status_anterior', OLD.status,
          'status_novo', NEW.status
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_tickets_sla_monitor ON public.tickets;
CREATE TRIGGER trigger_tickets_sla_monitor
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_sla_monitor();

-- Função para detectar SLAs vencidos e processar automaticamente
CREATE OR REPLACE FUNCTION public.process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tickets_updated INTEGER := 0;
  ticket_record RECORD;
BEGIN
  -- Buscar tickets com SLA vencido que não foram processados
  FOR ticket_record IN
    SELECT id, codigo_ticket, data_limite_sla, status, status_sla, escalonamento_nivel
    FROM public.tickets
    WHERE data_limite_sla < NOW()
      AND status_sla != 'vencido'
      AND status NOT IN ('concluido', 'cancelado')
  LOOP
    -- Atualizar status SLA para vencido (isso vai disparar o trigger)
    UPDATE public.tickets 
    SET status_sla = 'vencido',
        updated_at = NOW()
    WHERE id = ticket_record.id;
    
    -- Criar notificação de SLA vencido se não existir
    INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
    SELECT ticket_record.id, 'sla_breach', 
           jsonb_build_object(
             'codigo_ticket', ticket_record.codigo_ticket,
             'sla_vencido_em', ticket_record.data_limite_sla
           ), 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications_queue 
      WHERE ticket_id = ticket_record.id AND type = 'sla_breach'
    );
    
    tickets_updated := tickets_updated + 1;
  END LOOP;
  
  -- Log do processamento
  IF tickets_updated > 0 THEN
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'tickets_sla_batch',
      'process_overdue_slas',
      'Processamento automático de SLAs vencidos: ' || tickets_updated || ' tickets',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object('tickets_processados', tickets_updated),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN tickets_updated;
END;
$$;

-- Função para detectar SLAs em 50% e criar notificações
CREATE OR REPLACE FUNCTION public.process_sla_half_warnings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  notifications_created INTEGER := 0;
  ticket_record RECORD;
BEGIN
  -- Buscar tickets que atingiram 50% do SLA
  FOR ticket_record IN
    SELECT id, codigo_ticket, sla_half_time
    FROM public.tickets
    WHERE sla_half_time < NOW()
      AND status NOT IN ('concluido', 'cancelado', 'escalonado')
      AND status_sla = 'dentro_prazo'
  LOOP
    -- Criar notificação de 50% SLA se não existir
    INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
    SELECT ticket_record.id, 'sla_half', 
           jsonb_build_object(
             'codigo_ticket', ticket_record.codigo_ticket,
             'sla_half_time', ticket_record.sla_half_time
           ), 'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications_queue 
      WHERE ticket_id = ticket_record.id AND type = 'sla_half'
    );
    
    notifications_created := notifications_created + 1;
  END LOOP;
  
  RETURN notifications_created;
END;
$$;