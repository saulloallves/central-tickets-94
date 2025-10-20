-- Adicionar coluna sla_vencido_em para registrar timestamp de vencimento
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS sla_vencido_em TIMESTAMPTZ;

COMMENT ON COLUMN tickets.sla_vencido_em IS 'Timestamp de quando o SLA venceu pela primeira vez';

-- Remover função antiga e recriar com timestamp de vencimento
DROP FUNCTION IF EXISTS decrementar_sla_minutos();

CREATE FUNCTION decrementar_sla_minutos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrementar SLA de tickets ativos (não pausados, não concluídos)
  UPDATE tickets
  SET 
    sla_minutos_restantes = GREATEST(sla_minutos_restantes - 1, -9999),
    sla_ultima_atualizacao = NOW()
  WHERE 
    status != 'concluido'
    AND sla_pausado = false
    AND sla_pausado_mensagem = false
    AND sla_pausado_horario = false
    AND sla_minutos_restantes IS NOT NULL;

  -- Atualizar status_sla e registrar timestamp de vencimento
  UPDATE tickets
  SET 
    status_sla = 'vencido'::sla_status,
    sla_vencido_em = COALESCE(sla_vencido_em, NOW())  -- ✅ Registrar timestamp apenas na primeira vez
  WHERE 
    sla_minutos_restantes <= 0
    AND status_sla != 'vencido'
    AND status != 'concluido';

  -- Log
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'tickets',
    'decrementar_sla',
    'SLA decrementado em 1 minuto para todos os tickets ativos',
    NULL, NULL, NULL, NULL, NULL,
    jsonb_build_object('timestamp', NOW()),
    'sistema'::log_canal
  );
END;
$$;