-- ============================================
-- CORREÇÃO DEFINITIVA DO SISTEMA DE SLA E ESCALAMENTO
-- ============================================

-- 1. Criar tabela para rastrear pausas de SLA
CREATE TABLE IF NOT EXISTS pausas_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  pausa_inicio TIMESTAMPTZ NOT NULL,
  pausa_fim TIMESTAMPTZ,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pausas_sla_ticket_id ON pausas_sla(ticket_id);
CREATE INDEX IF NOT EXISTS idx_pausas_sla_active ON pausas_sla(ticket_id) WHERE pausa_fim IS NULL;

-- RLS para pausas_sla
ALTER TABLE pausas_sla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and diretoria manage pausas_sla"
  ON pausas_sla
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- 2. Função para calcular tempo total pausado
CREATE OR REPLACE FUNCTION calcular_tempo_pausado(p_ticket_id UUID)
RETURNS INTERVAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tempo_total INTERVAL := INTERVAL '0';
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN pausa_fim IS NOT NULL THEN pausa_fim - pausa_inicio
      WHEN pausa_inicio IS NOT NULL THEN NOW() - pausa_inicio
      ELSE INTERVAL '0'
    END
  ), INTERVAL '0')
  INTO tempo_total
  FROM pausas_sla
  WHERE ticket_id = p_ticket_id;
  
  RETURN tempo_total;
END;
$function$;

-- 3. Trigger para registrar pausas automaticamente
CREATE OR REPLACE FUNCTION trigger_registrar_pausa_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se começou a pausar (FALSE -> TRUE)
  IF NEW.sla_pausado = TRUE AND (OLD.sla_pausado = FALSE OR OLD.sla_pausado IS NULL) THEN
    INSERT INTO pausas_sla (ticket_id, pausa_inicio, motivo)
    VALUES (NEW.id, NOW(), 'Pausa automática de SLA');
  END IF;
  
  -- Se retomou (TRUE -> FALSE)
  IF NEW.sla_pausado = FALSE AND OLD.sla_pausado = TRUE THEN
    UPDATE pausas_sla
    SET pausa_fim = NOW()
    WHERE ticket_id = NEW.id AND pausa_fim IS NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_pausas_sla ON tickets;
CREATE TRIGGER trigger_pausas_sla
  AFTER UPDATE OF sla_pausado ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_registrar_pausa_sla();

-- 4. CORRIGIR process_overdue_slas para calcular SLA efetivo
CREATE OR REPLACE FUNCTION public.process_overdue_slas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ticket_record RECORD;
  tickets_processed INTEGER := 0;
  tempo_pausado INTERVAL;
  data_limite_efetiva TIMESTAMPTZ;
BEGIN
  -- Log de início
  RAISE NOTICE '🔍 Iniciando process_overdue_slas...';
  
  FOR ticket_record IN
    SELECT t.id, t.codigo_ticket, t.data_limite_sla, t.escalonamento_nivel, 
           t.unidade_id, t.prioridade, t.sla_pausado
    FROM public.tickets t
    WHERE t.status IN ('aberto', 'em_atendimento')
      AND t.data_limite_sla IS NOT NULL
      AND t.sla_pausado = FALSE  -- ✅ Só processar tickets que NÃO estão pausados
      AND (t.status_sla != 'vencido' OR t.status_sla IS NULL)
  LOOP
    -- Calcular tempo total pausado
    tempo_pausado := calcular_tempo_pausado(ticket_record.id);
    
    -- Calcular data limite efetiva (data_limite_sla + tempo_pausado)
    data_limite_efetiva := ticket_record.data_limite_sla + tempo_pausado;
    
    RAISE NOTICE '🎫 Ticket: % | SLA original: % | Tempo pausado: % | SLA efetivo: %',
      ticket_record.codigo_ticket,
      ticket_record.data_limite_sla,
      tempo_pausado,
      data_limite_efetiva;
    
    -- ✅ SÓ ESCALONAR SE O SLA EFETIVO VENCEU
    IF data_limite_efetiva < NOW() THEN
      RAISE NOTICE '🚨 SLA EFETIVO VENCIDO! Escalando ticket %', ticket_record.codigo_ticket;
      
      UPDATE public.tickets
      SET status = 'escalonado'::ticket_status,
          status_sla = 'vencido',
          escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel, 0), 1) + 1,
          updated_at = NOW()
      WHERE id = ticket_record.id;

      -- Criar notificação de sla_breach
      INSERT INTO public.notifications_queue (ticket_id, type, alert_level, payload, status)
      VALUES (
        ticket_record.id,
        'sla_breach',
        'critical',
        jsonb_build_object(
          'codigo_ticket', ticket_record.codigo_ticket,
          'sla_vencido_em', ticket_record.data_limite_sla,
          'sla_efetivo_vencido_em', data_limite_efetiva,
          'tempo_pausado_minutos', EXTRACT(EPOCH FROM tempo_pausado) / 60,
          'escalonamento_nivel', GREATEST(COALESCE(ticket_record.escalonamento_nivel, 0), 1) + 1,
          'unidade_id', ticket_record.unidade_id,
          'prioridade', ticket_record.prioridade,
          'acao', 'escalado_automaticamente',
          'timestamp', NOW()
        ),
        'pending'
      ) ON CONFLICT (ticket_id, type) WHERE type = 'sla_breach' DO NOTHING;

      -- Log da ação
      PERFORM public.log_sla_action(
        ticket_record.id,
        'SLA efetivo vencido - Ticket escalado automaticamente',
        jsonb_build_object(
          'sla_original', ticket_record.data_limite_sla,
          'tempo_pausado', tempo_pausado,
          'sla_efetivo', data_limite_efetiva,
          'escalonamento_nivel', GREATEST(COALESCE(ticket_record.escalonamento_nivel, 0), 1) + 1,
          'processado_em', NOW(),
          'automatico', true
        )
      );

      tickets_processed := tickets_processed + 1;
    ELSE
      RAISE NOTICE '✅ SLA efetivo ainda dentro do prazo para ticket %', ticket_record.codigo_ticket;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Processamento concluído: % tickets escalados', tickets_processed;
  RETURN tickets_processed;
END;
$function$;