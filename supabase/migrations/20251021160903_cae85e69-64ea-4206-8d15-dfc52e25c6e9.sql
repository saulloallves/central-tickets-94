-- ========================================
-- CORREÇÃO URGENTE: decrementar_sla_minutos() - erro de tipo
-- Erro: column "status_sla" is of type ticket_sla_status but expression is of type text
-- Solução: Adicionar CAST explícito para o enum ticket_sla_status
-- ========================================

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
      WHEN sla_minutos_restantes - 1 <= (sla_minutos_totais / 2) THEN 'metade'::ticket_sla_status
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

COMMENT ON FUNCTION public.decrementar_sla_minutos() IS 'Decrementa SLA de tickets ativos com CAST explícito para enum';