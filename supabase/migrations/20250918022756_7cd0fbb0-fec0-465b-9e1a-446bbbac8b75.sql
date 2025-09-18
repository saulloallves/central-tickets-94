-- Remover a função de processo batch e implementar escalonamento automático direto
-- Quando um ticket é criado ou atualizado, verificar se o SLA já está vencido e escalonar automaticamente

-- Melhorar o trigger tickets_before_insert para verificar SLA vencido na criação
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Gerar código se não tiver
  IF NEW.codigo_ticket IS NULL OR NEW.codigo_ticket = '' THEN
    NEW.codigo_ticket := next_ticket_code(NEW.unidade_id);
  END IF;

  -- Set default data_abertura
  IF NEW.data_abertura IS NULL THEN
    NEW.data_abertura := NOW();
  END IF;

  -- Auto-assign franqueado_id based on unidade_id
  IF NEW.franqueado_id IS NULL THEN
    SELECT f.id INTO NEW.franqueado_id
    FROM public.franqueados f
    WHERE f.unit_code ? NEW.unidade_id;
  END IF;

  -- Definir data_limite_sla conforme prioridade
  IF NEW.data_limite_sla IS NULL THEN
    CASE NEW.prioridade
      WHEN 'imediato' THEN NEW.data_limite_sla := NEW.data_abertura + INTERVAL '15 minutes';
      WHEN 'ate_1_hora' THEN NEW.data_limite_sla := NEW.data_abertura + INTERVAL '1 hour';
      WHEN 'ainda_hoje' THEN
        NEW.data_limite_sla := DATE_TRUNC('day', NEW.data_abertura) + INTERVAL '18 hours';
        IF NEW.data_limite_sla <= NEW.data_abertura THEN
          NEW.data_limite_sla := NEW.data_limite_sla + INTERVAL '1 day';
        END IF;
        IF EXTRACT(dow FROM NEW.data_limite_sla) = 6 THEN
          NEW.data_limite_sla := DATE_TRUNC('day', NEW.data_limite_sla) + INTERVAL '2 day' + INTERVAL '18 hour';
        ELSIF EXTRACT(dow FROM NEW.data_limite_sla) = 0 THEN
          NEW.data_limite_sla := DATE_TRUNC('day', NEW.data_limite_sla) + INTERVAL '1 day' + INTERVAL '18 hour';
        END IF;
      WHEN 'posso_esperar' THEN
        NEW.data_limite_sla := add_24h_skip_weekend(NEW.data_abertura);
      WHEN 'crise' THEN 
        NEW.data_limite_sla := NEW.data_abertura + INTERVAL '5 minutes';
        -- Apenas tickets de crise vão automaticamente para escalonado
        IF NEW.status = 'aberto' THEN
          NEW.status := 'escalonado';
        END IF;
      ELSE
        NEW.data_limite_sla := add_24h_skip_weekend(NEW.data_abertura);
    END CASE;
  END IF;

  -- VERIFICAR SE SLA JÁ ESTÁ VENCIDO NO MOMENTO DA CRIAÇÃO
  IF NOW() >= NEW.data_limite_sla THEN
    NEW.status_sla := 'vencido';
    -- Se o ticket não é de crise e está sendo criado com SLA já vencido, escalonar automaticamente
    IF NEW.prioridade != 'crise' AND NEW.status = 'aberto' THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Log do escalonamento automático na criação
      RAISE NOTICE 'Ticket % criado com SLA já vencido - escalonado automaticamente', NEW.codigo_ticket;
    END IF;
  ELSIF NOW() >= (NEW.data_limite_sla - INTERVAL '2 hours') THEN
    NEW.status_sla := 'alerta';
  ELSE
    NEW.status_sla := 'dentro_prazo';
  END IF;

  -- Meio do prazo para notificação de 50%
  NEW.sla_half_time := NEW.data_abertura + ((NEW.data_limite_sla - NEW.data_abertura) / 2);

  RETURN NEW;
END;
$$;

-- Melhorar o trigger tickets_before_update para escalonar automaticamente quando SLA vence
CREATE OR REPLACE FUNCTION public.tickets_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar timestamp
  NEW.updated_at := NOW();
  
  -- VERIFICAR SE SLA VENCEU AGORA E ESCALONAR AUTOMATICAMENTE
  IF NOW() >= NEW.data_limite_sla AND OLD.status_sla != 'vencido' THEN
    NEW.status_sla := 'vencido';
    
    -- Se ticket está em aberto ou em_atendimento, escalonar automaticamente
    IF NEW.status IN ('aberto', 'em_atendimento') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Log do escalonamento automático
      RAISE NOTICE 'Ticket % SLA vencido - escalonado automaticamente de % para escalonado', 
        NEW.codigo_ticket, OLD.status;
        
      -- Criar notificação de SLA vencido
      INSERT INTO public.notifications_queue (ticket_id, type, payload, status)
      VALUES (NEW.id, 'sla_breach', 
             jsonb_build_object(
               'codigo_ticket', NEW.codigo_ticket,
               'sla_vencido_em', NEW.data_limite_sla,
               'status_antes_escalacao', OLD.status,
               'escalonamento_automatico', true
             ), 'pending')
      ON CONFLICT (ticket_id, type) WHERE type = 'sla_breach' DO NOTHING;
    END IF;
  ELSIF NOW() >= (NEW.data_limite_sla - INTERVAL '2 hours') AND OLD.status_sla = 'dentro_prazo' THEN
    NEW.status_sla := 'alerta';
  END IF;

  RETURN NEW;
END;
$$;

-- Remover a função process_overdue_slas já que não vamos mais usar processo batch
DROP FUNCTION IF EXISTS public.process_overdue_slas();