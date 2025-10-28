-- ========================================
-- CORREÇÃO: sync_status_sla() com enum correto
-- ========================================

CREATE OR REPLACE FUNCTION sync_status_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Sincroniza status_sla baseado em sla_minutos_restantes
  IF NEW.sla_minutos_restantes <= 0 THEN
    NEW.status_sla := 'vencido'::ticket_sla_status;
    NEW.sla_vencido_em := COALESCE(NEW.sla_vencido_em, NOW());
    NEW.dentro_prazo := false;
  ELSIF NEW.sla_minutos_restantes <= 30 THEN
    NEW.status_sla := 'alerta'::ticket_sla_status;
  ELSE
    NEW.status_sla := 'dentro_prazo'::ticket_sla_status;
    NEW.dentro_prazo := true;
  END IF;

  RETURN NEW;
END;
$$;