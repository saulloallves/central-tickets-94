-- ============================================================================
-- CORREÇÃO: Ajustar lógica do trigger acumular_tempo_pausado
-- ============================================================================
-- Problema: tempo_pausado_total está acumulando tempo fora do horário comercial
-- Solução: Acumular APENAS quando sla_pausado OU sla_pausado_mensagem = true
-- ============================================================================

CREATE OR REPLACE FUNCTION acumular_tempo_pausado()
RETURNS TRIGGER AS $$
DECLARE
  tempo_pausado_interval INTERVAL;
  alguma_pausa_ativa BOOLEAN;
  alguma_pausa_estava_ativa BOOLEAN;
BEGIN
  -- Verificar se ALGUMA pausa (que acumula tempo) está ativa agora
  -- IMPORTANTE: sla_pausado_horario NÃO acumula tempo, apenas pausa o decremento
  alguma_pausa_ativa := (NEW.sla_pausado = true OR NEW.sla_pausado_mensagem = true);
  
  -- Verificar se ALGUMA pausa (que acumula tempo) estava ativa antes
  alguma_pausa_estava_ativa := (OLD.sla_pausado = true OR OLD.sla_pausado_mensagem = true);

  -- CASO 1: Pausou agora (false → true)
  IF NOT alguma_pausa_estava_ativa AND alguma_pausa_ativa THEN
    NEW.ultima_pausa_timestamp := now();
    RAISE NOTICE 'Ticket % pausado. Timestamp registrado: %', NEW.codigo_ticket, NEW.ultima_pausa_timestamp;
  
  -- CASO 2: Despausou agora (true → false)
  ELSIF alguma_pausa_estava_ativa AND NOT alguma_pausa_ativa THEN
    IF OLD.ultima_pausa_timestamp IS NOT NULL THEN
      -- Calcular quanto tempo ficou pausado (como INTERVAL)
      tempo_pausado_interval := now() - OLD.ultima_pausa_timestamp;
      
      -- Acumular no total (INTERVAL)
      NEW.tempo_pausado_total := COALESCE(NEW.tempo_pausado_total, INTERVAL '0') + tempo_pausado_interval;
      
      -- Limpar timestamp de pausa
      NEW.ultima_pausa_timestamp := NULL;
      
      RAISE NOTICE 'Ticket % despausado. Tempo pausado: %. Total acumulado: %', 
        NEW.codigo_ticket, tempo_pausado_interval, NEW.tempo_pausado_total;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Log da migration
DO $$
BEGIN
  RAISE NOTICE '✅ CORREÇÃO APLICADA: Trigger acumular_tempo_pausado ajustado';
  RAISE NOTICE '   - tempo_pausado_total agora acumula APENAS quando:';
  RAISE NOTICE '     • sla_pausado = true (pausa manual)';
  RAISE NOTICE '     • sla_pausado_mensagem = true (aguardando cliente)';
  RAISE NOTICE '   - NÃO acumula quando sla_pausado_horario = true (fora do horário)';
END $$;