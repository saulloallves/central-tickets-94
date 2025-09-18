-- Melhorar o trigger de SLA para garantir escalação automática
CREATE OR REPLACE FUNCTION public.auto_process_sla_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se SLA está vencido e atualizar automaticamente
  IF NEW.data_limite_sla IS NOT NULL AND NEW.data_limite_sla < NOW() THEN
    -- Marcar SLA como vencido
    NEW.status_sla := 'vencido';
    
    -- Escalonar automaticamente se não estiver concluído ou já escalonado
    IF NEW.status NOT IN ('escalonado', 'concluido') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Criar notificação de SLA vencido (será processada pelo trigger de notificação)
      INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
      VALUES (
        NEW.id, 
        'sla_breach', 
        jsonb_build_object(
          'codigo_ticket', NEW.codigo_ticket,
          'sla_vencido_em', NEW.data_limite_sla,
          'escalonamento_nivel', NEW.escalonamento_nivel,
          'trigger_automatico', true
        ), 
        'pending'
      ) ON CONFLICT (ticket_id, type) WHERE type = 'sla_breach' DO NOTHING;
      
      -- Log da ação
      PERFORM public.log_sla_action(
        NEW.id,
        'SLA vencido - Ticket escalonado automaticamente via trigger',
        jsonb_build_object(
          'sla_vencido_em', NEW.data_limite_sla,
          'escalonamento_nivel', NEW.escalonamento_nivel,
          'trigger_executado', NOW(),
          'automatico', true
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Também criar um trigger BEFORE INSERT para novos tickets que já nascem vencidos
CREATE OR REPLACE FUNCTION public.auto_process_sla_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se ticket já nasce com SLA vencido
  IF NEW.data_limite_sla IS NOT NULL AND NEW.data_limite_sla < NOW() THEN
    NEW.status_sla := 'vencido';
    
    -- Se não for concluído, escalonar imediatamente
    IF NEW.status NOT IN ('escalonado', 'concluido') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garantir que os triggers estão ativos
DROP TRIGGER IF EXISTS trigger_auto_process_sla_on_update ON public.tickets;
CREATE TRIGGER trigger_auto_process_sla_on_update
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_process_sla_on_update();

DROP TRIGGER IF EXISTS trigger_auto_process_sla_on_insert ON public.tickets;
CREATE TRIGGER trigger_auto_process_sla_on_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_process_sla_on_insert();