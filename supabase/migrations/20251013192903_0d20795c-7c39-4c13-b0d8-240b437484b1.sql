-- ============================================
-- CORREÇÃO CRÍTICA: SLA com pausas
-- ============================================
-- 1. Corrigir trigger auto_process_sla_on_update() para respeitar tempo pausado
-- 2. Corrigir dados existentes marcados incorretamente como vencidos

-- ✅ 1. ATUALIZAR TRIGGER para considerar tempo_pausado_total
CREATE OR REPLACE FUNCTION public.auto_process_sla_on_update()
RETURNS TRIGGER AS $$
DECLARE
  data_limite_efetiva TIMESTAMPTZ;
BEGIN
  -- ✅ Não processar se estiver pausado
  IF NEW.sla_pausado = TRUE OR NEW.sla_pausado_mensagem = TRUE THEN
    RETURN NEW;
  END IF;

  -- ✅ Calcular data limite efetiva (deadline original + tempo pausado acumulado)
  data_limite_efetiva := NEW.data_limite_sla + COALESCE(NEW.tempo_pausado_total, INTERVAL '0');
  
  -- ✅ Verificar se SLA está REALMENTE vencido (considerando pausas)
  IF NEW.data_limite_sla IS NOT NULL AND data_limite_efetiva < NOW() THEN
    NEW.status_sla := 'vencido';
    
    -- Escalonar apenas se não estiver concluído ou já escalonado
    IF NEW.status NOT IN ('escalonado', 'concluido') THEN
      NEW.status := 'escalonado'::ticket_status;
      NEW.escalonamento_nivel := GREATEST(COALESCE(NEW.escalonamento_nivel, 0), 1) + 1;
      
      -- Log do escalonamento automático
      PERFORM public.log_system_action(
        'sistema'::public.log_tipo,
        'tickets',
        NEW.id::TEXT,
        'SLA vencido - Ticket escalonado automaticamente',
        NULL,
        NULL, NULL, NULL,
        to_jsonb(OLD),
        to_jsonb(NEW),
        'web'::public.log_canal
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ✅ 2. CORRIGIR DADOS EXISTENTES: Recalcular status_sla de tickets marcados incorretamente
UPDATE tickets
SET status_sla = 
  CASE 
    WHEN sla_pausado = TRUE OR sla_pausado_mensagem = TRUE THEN status_sla
    WHEN (data_limite_sla + COALESCE(tempo_pausado_total, INTERVAL '0')) > NOW() 
    THEN 'dentro_prazo'
    ELSE 'vencido'
  END
WHERE status_sla = 'vencido'
  AND (data_limite_sla + COALESCE(tempo_pausado_total, INTERVAL '0')) > NOW()
  AND status NOT IN ('concluido');

-- Log da correção
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'tickets',
    'migration'::TEXT,
    'Correção automática de SLA - ' || affected_count || ' tickets corrigidos',
    NULL,
    NULL, NULL, NULL,
    NULL,
    jsonb_build_object('affected_tickets', affected_count),
    'web'::public.log_canal
  );
END $$;