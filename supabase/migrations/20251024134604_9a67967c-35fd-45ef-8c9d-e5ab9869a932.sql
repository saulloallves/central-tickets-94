-- ==========================================
-- FIX: Sync status_sla with calculated values
-- ==========================================

-- STEP 1: Fix ticket 1268-0001 that was escalated with time remaining
UPDATE tickets
SET 
  status = 'em_atendimento',
  escalonamento_nivel = 0,
  sla_escalado_em = NULL,
  updated_at = NOW()
WHERE codigo_ticket = '1268-0001'
  AND status = 'escalonado'
  AND calcular_minutos_uteis_restantes(data_limite_sla) > 0;

-- STEP 2: Create trigger to keep status_sla synchronized
CREATE OR REPLACE FUNCTION sync_status_sla()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate status_sla dynamically based on remaining time
  IF NEW.data_limite_sla IS NULL THEN
    NEW.status_sla := 'dentro_prazo'::ticket_sla_status;
  ELSIF calcular_minutos_uteis_restantes(NEW.data_limite_sla) < 0 THEN
    NEW.status_sla := 'vencido'::ticket_sla_status;
  ELSIF calcular_minutos_uteis_restantes(NEW.data_limite_sla) <= 60 THEN
    NEW.status_sla := 'alerta'::ticket_sla_status;
  ELSE
    NEW.status_sla := 'dentro_prazo'::ticket_sla_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_status_sla
  BEFORE INSERT OR UPDATE OF data_limite_sla, tempo_pausado_total, sla_pausado
  ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION sync_status_sla();

-- STEP 3: Sync status_sla for all existing active tickets
UPDATE tickets t
SET status_sla = CASE
  WHEN t.data_limite_sla IS NULL THEN 'dentro_prazo'::ticket_sla_status
  WHEN calcular_minutos_uteis_restantes(t.data_limite_sla) < 0 THEN 'vencido'::ticket_sla_status
  WHEN calcular_minutos_uteis_restantes(t.data_limite_sla) <= 60 THEN 'alerta'::ticket_sla_status
  ELSE 'dentro_prazo'::ticket_sla_status
END
WHERE t.status != 'concluido';