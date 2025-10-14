-- Recriar função adjust_sla_for_business_hours para usar 17:30
CREATE OR REPLACE FUNCTION public.adjust_sla_for_business_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  in_business_hours BOOLEAN;
  next_business_start TIMESTAMPTZ;
  sla_minutes INT;
BEGIN
  -- Verificar se está em horário comercial (agora usa 17:30)
  in_business_hours := public.is_business_hours();
  
  IF NOT in_business_hours THEN
    -- Calcular próximo início (agora retorna próximo dia útil 08:30 após 17:30)
    next_business_start := public.get_next_business_hour_start();
    
    -- Obter SLA baseado na prioridade
    sla_minutes := public.get_sla_minutes_for_priority(NEW.prioridade);
    
    -- Ajustar data limite SLA: próximo horário comercial + SLA normal
    NEW.data_limite_sla := next_business_start + (sla_minutes || ' minutes')::INTERVAL;
    NEW.sla_half_time := next_business_start + ((sla_minutes / 2) || ' minutes')::INTERVAL;
    
    -- Marcar como pausado desde a criação
    NEW.sla_pausado := TRUE;
    NEW.sla_pausado_em := NOW();
    NEW.sla_pausado_mensagem := FALSE;
    NEW.pode_despausar_as_0830 := FALSE;
    
    -- Log da ação
    PERFORM public.log_sla_action(
      NEW.id,
      'Ticket criado fora do horário (após 17:30) - SLA ajustado para próximo dia útil',
      jsonb_build_object(
        'horario_criacao', NEW.data_abertura,
        'proximo_inicio_comercial', next_business_start,
        'sla_ajustado_para', NEW.data_limite_sla,
        'sla_minutes', sla_minutes,
        'prioridade', NEW.prioridade,
        'horario_fechamento', '17:30'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.adjust_sla_for_business_hours() IS 
'Ajusta SLA de tickets criados fora do horário comercial (antes 08:30 ou após 17:30). 
Calcula prazo baseado no próximo dia útil às 08:30 + tempo normal de SLA';