-- ==========================================
-- Corrigir cálculo de SLA para respeitar horário comercial
-- ==========================================

-- 1. Atualizar função auto_process_sla_on_insert
--    REMOVER: Cálculo de data_limite_sla
--    MANTER: Lógica de pausa e status SLA
CREATE OR REPLACE FUNCTION public.auto_process_sla_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sp_time TIMESTAMP WITH TIME ZONE;
  day_of_week INT;
  hour INT;
  minutes INT;
  time_in_minutes INT;
  is_business_hours BOOLEAN;
BEGIN
  -- Obter horário de São Paulo
  sp_time := timezone('America/Sao_Paulo', NEW.data_abertura);
  day_of_week := EXTRACT(DOW FROM sp_time);
  hour := EXTRACT(HOUR FROM sp_time);
  minutes := EXTRACT(MINUTE FROM sp_time);
  time_in_minutes := hour * 60 + minutes;
  
  -- Verificar se está dentro do horário comercial (8h30-17h30, segunda a sábado)
  is_business_hours := (
    day_of_week >= 1 AND day_of_week <= 6 AND
    time_in_minutes >= 510 AND time_in_minutes < 1050
  );
  
  -- Pausar SLA se ticket criado fora do horário comercial
  IF NOT is_business_hours THEN
    NEW.sla_pausado_horario := true;
    NEW.sla_pausado_em := NEW.data_abertura;
    
    RAISE NOTICE 'Ticket criado FORA do horário comercial - SLA PAUSADO';
  ELSE
    NEW.sla_pausado_horario := false;
    NEW.sla_pausado_em := NULL;
    
    RAISE NOTICE 'Ticket criado DENTRO do horário comercial - SLA ATIVO';
  END IF;

  -- Verificar status SLA (só após data_limite_sla ser definida por outro trigger)
  IF NEW.data_limite_sla IS NOT NULL THEN
    IF NEW.data_limite_sla < NOW() THEN
      NEW.status_sla := 'vencido';
      
      IF NEW.status NOT IN ('escalonado', 'concluido') THEN
        NEW.status := 'escalonado'::ticket_status;
        NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1);
      END IF;
    ELSIF NOW() >= (NEW.data_limite_sla - INTERVAL '2 hours') THEN
      NEW.status_sla := 'alerta';
    ELSE
      NEW.status_sla := 'dentro_prazo';
    END IF;

    -- Meio do prazo para notificação de 50%
    NEW.sla_half_time := NEW.data_abertura + ((NEW.data_limite_sla - NEW.data_abertura) / 2);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Garantir que trigger_set_sla_deadline execute ANTES de auto_process
--    Renomear trigger para garantir ordem alfabética correta
DROP TRIGGER IF EXISTS set_sla_deadline_on_insert ON tickets;
DROP TRIGGER IF EXISTS aaa_set_sla_deadline_first ON tickets;

CREATE TRIGGER aaa_set_sla_deadline_first
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_sla_deadline();

-- 3. Atualizar tickets existentes com data_limite_sla incorreta
--    (recalcular apenas tickets ativos criados nas últimas 48h)
DO $$
DECLARE
  v_ticket RECORD;
  v_novo_limite TIMESTAMPTZ;
BEGIN
  FOR v_ticket IN 
    SELECT id, data_abertura, data_limite_sla, prioridade, codigo_ticket
    FROM tickets
    WHERE status IN ('aberto', 'em_atendimento', 'escalonado')
      AND data_abertura > NOW() - INTERVAL '48 hours'
      AND data_limite_sla IS NOT NULL
  LOOP
    -- Recalcular limite correto
    v_novo_limite := calcular_data_limite_sla(v_ticket.data_abertura, v_ticket.prioridade::TEXT);
    
    -- Só atualizar se houver diferença significativa (> 30 min)
    IF ABS(EXTRACT(EPOCH FROM (v_novo_limite - v_ticket.data_limite_sla))/60) > 30 THEN
      UPDATE tickets
      SET 
        data_limite_sla = v_novo_limite,
        sla_half_time = data_abertura + ((v_novo_limite - data_abertura) / 2),
        sla_minutos_totais = EXTRACT(EPOCH FROM (v_novo_limite - data_abertura)) / 60
      WHERE id = v_ticket.id;
      
      RAISE NOTICE 'Ticket % recalculado: % -> %', 
        v_ticket.codigo_ticket,
        v_ticket.data_limite_sla,
        v_novo_limite;
    END IF;
  END LOOP;
END $$;

-- 4. Comentários e documentação
COMMENT ON FUNCTION public.trigger_set_sla_deadline() IS 
'[ÚNICO RESPONSÁVEL] Calcula data_limite_sla respeitando horário comercial (8:30-17:30, Seg-Sáb)';

COMMENT ON FUNCTION public.auto_process_sla_on_insert() IS 
'Define pausa automática e status SLA. NÃO calcula data_limite_sla (delegado para trigger_set_sla_deadline).';

COMMENT ON TRIGGER aaa_set_sla_deadline_first ON tickets IS 
'Executa PRIMEIRO (prefixo aaa_) para calcular data_limite_sla com horário comercial antes de outros triggers.';