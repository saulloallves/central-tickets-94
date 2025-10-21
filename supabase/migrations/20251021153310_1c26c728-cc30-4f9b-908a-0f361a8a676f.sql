-- ========================================
-- CORREÇÃO CRÍTICA: Remover coluna inexistente sla_pausado_feedback
-- ========================================

-- 1. Corrigir função decrementar_sla_minutos
DROP FUNCTION IF EXISTS public.decrementar_sla_minutos();

CREATE OR REPLACE FUNCTION public.decrementar_sla_minutos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrementar SLA de todos os tickets ativos que não estão pausados
  -- ✅ REMOVIDA REFERÊNCIA À COLUNA INEXISTENTE sla_pausado_feedback
  UPDATE tickets
  SET 
    sla_minutos_restantes = sla_minutos_restantes - 1,
    status_sla = CASE
      WHEN sla_minutos_restantes - 1 <= 0 THEN 'vencido'::sla_status
      WHEN sla_minutos_restantes - 1 <= (sla_minutos_totais / 2) THEN 'meio_prazo'::sla_status
      ELSE 'normal'::sla_status
    END,
    sla_vencido_em = CASE
      WHEN sla_minutos_restantes - 1 = 0 THEN NOW()
      ELSE sla_vencido_em
    END,
    updated_at = NOW()
  WHERE 
    status != 'concluido'
    AND sla_pausado = false
    AND sla_pausado_horario = false;
    
  RAISE NOTICE 'SLA decrementado em 1 minuto para tickets ativos';
END;
$$;

COMMENT ON FUNCTION public.decrementar_sla_minutos() IS 'Decrementa SLA de tickets ativos sem limitações de valores negativos';

-- 2. Configurar notificações para sla_breach (usando estrutura correta)
INSERT INTO notification_source_config (
  notification_type,
  source_type,
  source_table,
  source_column,
  description,
  is_active
)
VALUES (
  'sla_breach',
  'column',
  'unidades',
  'id_grupo_vermelho',
  'Notificações de SLA vencido enviadas para grupo vermelho',
  true
)
ON CONFLICT (notification_type) DO UPDATE
SET 
  source_column = EXCLUDED.source_column,
  description = EXCLUDED.description,
  is_active = true;

-- Log da migration
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'fix_sla_pausado_feedback_column',
  'Corrigida referência à coluna inexistente sla_pausado_feedback',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'changes', ARRAY[
      'decrementar_sla_minutos: removida referência a sla_pausado_feedback',
      'notification_source_config: garantida configuração para sla_breach'
    ]
  ),
  'sistema'::log_canal
);