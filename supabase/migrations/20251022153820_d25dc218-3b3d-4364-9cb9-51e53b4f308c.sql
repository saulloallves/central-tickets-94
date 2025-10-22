-- ========================================
-- CORREÇÃO: Valores inválidos do enum ticket_sla_status
-- ========================================
-- Problema: Funções estavam usando valores inválidos como 'metade', 'meio_prazo', 'normal', 'atencao'
-- Solução: Corrigir para usar apenas os valores válidos do enum: 'dentro_prazo', 'alerta', 'vencido'
-- ========================================

-- 1. RECRIAR decrementar_sla_minutos() com valores corretos
DROP FUNCTION IF EXISTS public.decrementar_sla_minutos();

CREATE OR REPLACE FUNCTION public.decrementar_sla_minutos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tickets
  SET 
    sla_minutos_restantes = sla_minutos_restantes - 1,
    status_sla = CASE
      WHEN sla_minutos_restantes - 1 <= 0 THEN 'vencido'::ticket_sla_status
      WHEN sla_minutos_restantes - 1 <= (sla_minutos_totais / 2) THEN 'alerta'::ticket_sla_status
      ELSE 'dentro_prazo'::ticket_sla_status
    END,
    sla_vencido_em = CASE
      WHEN sla_minutos_restantes - 1 <= 0 AND sla_vencido_em IS NULL THEN NOW()
      ELSE sla_vencido_em
    END,
    updated_at = NOW()
  WHERE 
    status != 'concluido'
    AND sla_pausado = false
    AND sla_pausado_mensagem = false
    AND sla_pausado_horario = false
    AND sla_minutos_restantes > -1440;
END;
$$;

COMMENT ON FUNCTION public.decrementar_sla_minutos() IS 'Decrementa SLA de tickets ativos usando valores corretos do enum: dentro_prazo, alerta, vencido';

-- 2. RECRIAR calcular_sla_tempo_real() com valores corretos
DROP FUNCTION IF EXISTS public.calcular_sla_tempo_real(UUID);

CREATE OR REPLACE FUNCTION calcular_sla_tempo_real(
  p_ticket_id UUID
)
RETURNS TABLE (
  sla_minutos_decorridos INTEGER,
  sla_minutos_restantes INTEGER,
  status_sla ticket_sla_status,
  is_overdue BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_minutos_decorridos INTEGER;
  v_minutos_restantes INTEGER;
  v_status_sla ticket_sla_status;
  v_is_overdue BOOLEAN;
BEGIN
  -- Buscar dados do ticket
  SELECT 
    t.created_at,
    t.sla_minutos_totais,
    t.tempo_pausado_total,
    t.sla_pausado,
    t.sla_pausado_horario,
    t.sla_pausado_feedback,
    t.status
  INTO v_ticket
  FROM tickets t
  WHERE t.id = p_ticket_id;

  -- Se ticket não existe ou está concluído, retornar NULL
  IF NOT FOUND OR v_ticket.status = 'concluido' THEN
    RETURN;
  END IF;

  -- Calcular minutos decorridos desde abertura
  v_minutos_decorridos := EXTRACT(EPOCH FROM (NOW() - v_ticket.created_at)) / 60;

  -- Subtrair tempo pausado total
  v_minutos_decorridos := v_minutos_decorridos - COALESCE(v_ticket.tempo_pausado_total, 0);

  -- Calcular minutos restantes
  v_minutos_restantes := COALESCE(v_ticket.sla_minutos_totais, 0) - v_minutos_decorridos;

  -- Determinar status do SLA
  v_is_overdue := v_minutos_restantes <= 0;

  IF v_is_overdue THEN
    v_status_sla := 'vencido'::ticket_sla_status;
  ELSIF v_minutos_restantes <= (COALESCE(v_ticket.sla_minutos_totais, 0) / 2) THEN
    v_status_sla := 'alerta'::ticket_sla_status;
  ELSE
    v_status_sla := 'dentro_prazo'::ticket_sla_status;
  END IF;

  -- Retornar valores calculados
  RETURN QUERY SELECT 
    v_minutos_decorridos,
    v_minutos_restantes,
    v_status_sla,
    v_is_overdue;
END;
$$;

COMMENT ON FUNCTION calcular_sla_tempo_real(UUID) IS 'Calcula SLA em tempo real usando valores corretos do enum: dentro_prazo, alerta, vencido';

-- 3. RECRIAR a view com a função corrigida
DROP VIEW IF EXISTS tickets_with_realtime_sla CASCADE;

CREATE OR REPLACE VIEW tickets_with_realtime_sla AS
SELECT 
  t.*,
  sla.sla_minutos_decorridos,
  sla.sla_minutos_restantes AS sla_minutos_restantes_calculado,
  sla.status_sla AS status_sla_calculado,
  sla.is_overdue
FROM tickets t
LEFT JOIN LATERAL calcular_sla_tempo_real(t.id) sla ON true;

COMMENT ON VIEW tickets_with_realtime_sla IS 'View que expõe tickets com valores de SLA calculados em tempo real usando enum correto';

-- 4. ATUALIZAR tickets existentes que possam ter valores incorretos
-- Recalcular status_sla baseado nos minutos restantes atuais
UPDATE tickets
SET status_sla = CASE
  WHEN sla_minutos_restantes <= 0 THEN 'vencido'::ticket_sla_status
  WHEN sla_minutos_restantes <= (sla_minutos_totais / 2) THEN 'alerta'::ticket_sla_status
  ELSE 'dentro_prazo'::ticket_sla_status
END
WHERE status != 'concluido'
  AND sla_minutos_totais IS NOT NULL;

-- Log da correção
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_ticket_sla_status_enum',
  'Corrigido uso de valores inválidos do enum ticket_sla_status',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'valores_validos', ARRAY['dentro_prazo', 'alerta', 'vencido'],
    'valores_removidos', ARRAY['metade', 'meio_prazo', 'normal', 'atencao'],
    'funcoes_corrigidas', ARRAY[
      'decrementar_sla_minutos()',
      'calcular_sla_tempo_real()',
      'tickets_with_realtime_sla view'
    ]
  ),
  'sistema'::log_canal
);