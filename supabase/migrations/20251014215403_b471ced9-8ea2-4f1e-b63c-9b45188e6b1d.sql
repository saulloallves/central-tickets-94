-- ============================================================
-- PARTE 1: Corrigir horário comercial para 17:30
-- ============================================================

-- Atualizar função is_business_hours para usar 17:30
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_brt TIMESTAMPTZ;
  day_of_week INT;
  time_of_day TIME;
BEGIN
  now_brt := timezone('America/Sao_Paulo', now());
  day_of_week := EXTRACT(DOW FROM now_brt);
  time_of_day := now_brt::TIME;
  
  -- Segunda a Sábado (1-6), das 08:30 às 17:30
  IF day_of_week BETWEEN 1 AND 6 
     AND time_of_day >= '08:30:00'::TIME 
     AND time_of_day < '17:30:00'::TIME THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- Atualizar função get_next_business_hour_start para usar 17:30
CREATE OR REPLACE FUNCTION public.get_next_business_hour_start()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_brt TIMESTAMPTZ;
  day_of_week INT;
  time_of_day TIME;
  next_start TIMESTAMPTZ;
BEGIN
  now_brt := timezone('America/Sao_Paulo', now());
  day_of_week := EXTRACT(DOW FROM now_brt);
  time_of_day := now_brt::TIME;
  
  -- Se é domingo (0), próximo início é segunda 08:30
  IF day_of_week = 0 THEN
    next_start := date_trunc('day', now_brt) + INTERVAL '1 day' + INTERVAL '8 hours 30 minutes';
    RETURN timezone('UTC', next_start);
  END IF;
  
  -- Se é sábado após 17:30, próximo início é segunda 08:30
  IF day_of_week = 6 AND time_of_day >= '17:30:00'::TIME THEN
    next_start := date_trunc('day', now_brt) + INTERVAL '2 days' + INTERVAL '8 hours 30 minutes';
    RETURN timezone('UTC', next_start);
  END IF;
  
  -- Se é dia útil mas antes das 08:30, próximo início é hoje 08:30
  IF time_of_day < '08:30:00'::TIME THEN
    next_start := date_trunc('day', now_brt) + INTERVAL '8 hours 30 minutes';
    RETURN timezone('UTC', next_start);
  END IF;
  
  -- Se é dia útil após 17:30, próximo início é amanhã 08:30
  IF time_of_day >= '17:30:00'::TIME THEN
    -- Se é sexta, pula para segunda
    IF day_of_week = 5 THEN
      next_start := date_trunc('day', now_brt) + INTERVAL '3 days' + INTERVAL '8 hours 30 minutes';
    ELSE
      next_start := date_trunc('day', now_brt) + INTERVAL '1 day' + INTERVAL '8 hours 30 minutes';
    END IF;
    RETURN timezone('UTC', next_start);
  END IF;
  
  -- Se está no horário comercial, retorna now
  RETURN now();
EXCEPTION WHEN OTHERS THEN
  RETURN now() + INTERVAL '1 day';
END;
$$;

-- ============================================================
-- PARTE 2: Adicionar coluna para controlar despause às 08:30
-- ============================================================

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS pode_despausar_as_0830 BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.tickets.pode_despausar_as_0830 IS 'Flag para indicar que ticket pode ser despausado às 08:30 se franqueado respondeu fora do horário';

-- ============================================================
-- PARTE 3: Recriar função pause_sla_tickets com nova assinatura
-- ============================================================

-- Dropar função antiga
DROP FUNCTION IF EXISTS public.pause_sla_tickets();

-- Criar nova função com lógica de prioridade
CREATE OR REPLACE FUNCTION public.pause_sla_tickets()
RETURNS TABLE(
  pausados INTEGER,
  despausados INTEGER,
  mantidos_pausados INTEGER,
  detalhes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_business BOOLEAN;
  count_pausados INTEGER := 0;
  count_despausados INTEGER := 0;
  count_mantidos INTEGER := 0;
  details JSONB := '[]'::jsonb;
BEGIN
  is_business := public.is_business_hours();
  
  -- FORA DO HORÁRIO COMERCIAL (após 17:30 ou antes de 08:30)
  IF NOT is_business THEN
    -- Pausar todos os tickets ativos por horário
    -- (independente se já estão pausados por mensagem)
    UPDATE public.tickets
    SET 
      sla_pausado = TRUE,
      sla_pausado_em = COALESCE(sla_pausado_em, NOW())
    WHERE status IN ('aberto', 'em_atendimento', 'aguardando_resposta')
      AND status != 'concluido'
      AND sla_pausado = FALSE;
    
    GET DIAGNOSTICS count_pausados = ROW_COUNT;
    
    details := jsonb_build_object(
      'action', 'pause',
      'reason', 'Fora do horário comercial',
      'pausados', count_pausados,
      'timestamp', NOW()
    );
    
    PERFORM public.log_sla_action(
      NULL,
      'Pausa automática por horário - ' || count_pausados || ' tickets',
      details
    );
    
  -- DENTRO DO HORÁRIO COMERCIAL (08:30 - 17:30)
  ELSE
    -- Despausar apenas tickets que NÃO estão aguardando resposta
    -- OU que franqueado já respondeu fora do horário (pode_despausar_as_0830 = TRUE)
    UPDATE public.tickets
    SET 
      sla_pausado = FALSE,
      sla_pausado_em = NULL,
      pode_despausar_as_0830 = FALSE
    WHERE status IN ('aberto', 'em_atendimento', 'aguardando_resposta')
      AND status != 'concluido'
      AND sla_pausado = TRUE
      AND (
        -- Não está aguardando resposta
        sla_pausado_mensagem = FALSE
        -- OU está marcado para despausar às 08:30 (franqueado respondeu durante a noite)
        OR pode_despausar_as_0830 = TRUE
      );
    
    GET DIAGNOSTICS count_despausados = ROW_COUNT;
    
    -- Contar quantos ficaram pausados por ainda aguardar resposta
    SELECT COUNT(*) INTO count_mantidos
    FROM public.tickets
    WHERE status IN ('aberto', 'em_atendimento', 'aguardando_resposta')
      AND status != 'concluido'
      AND sla_pausado = TRUE
      AND sla_pausado_mensagem = TRUE
      AND pode_despausar_as_0830 = FALSE;
    
    details := jsonb_build_object(
      'action', 'resume',
      'reason', 'Horário comercial retomado',
      'despausados', count_despausados,
      'mantidos_pausados_por_mensagem', count_mantidos,
      'timestamp', NOW()
    );
    
    PERFORM public.log_sla_action(
      NULL,
      'Retomada automática - ' || count_despausados || ' despausados, ' || count_mantidos || ' mantidos aguardando resposta',
      details
    );
  END IF;
  
  RETURN QUERY SELECT count_pausados, count_despausados, count_mantidos, details;
END;
$$;

-- ============================================================
-- PARTE 4: Atualizar trigger de mensagens para respeitar prioridade
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_pause_sla_on_outgoing_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_business BOOLEAN;
BEGIN
  -- Mensagem de SAÍDA (suporte respondeu)
  IF NEW.direcao = 'saida' THEN
    UPDATE tickets
    SET 
      sla_pausado_mensagem = TRUE,
      sla_pausado_em = NOW()
    WHERE id = NEW.ticket_id
      AND sla_pausado_mensagem = FALSE;
  
  -- Mensagem de ENTRADA (franqueado respondeu)
  ELSIF NEW.direcao = 'entrada' THEN
    is_business := public.is_business_hours();
    
    -- Se franqueado responde DENTRO do horário comercial
    IF is_business THEN
      -- Remove ambas as pausas normalmente
      UPDATE tickets
      SET 
        sla_pausado_mensagem = FALSE,
        sla_pausado = FALSE,
        sla_pausado_em = NULL,
        pode_despausar_as_0830 = FALSE
      WHERE id = NEW.ticket_id;
    
    -- Se franqueado responde FORA do horário comercial (ex: 22h)
    ELSE
      -- Remove pausa de mensagem, mas mantém pausa de horário
      -- Marca para despausar às 08:30
      UPDATE tickets
      SET 
        sla_pausado_mensagem = FALSE,
        pode_despausar_as_0830 = TRUE
        -- sla_pausado continua TRUE (pausa de horário)
        -- será despausado às 08:30 pelo cron job
      WHERE id = NEW.ticket_id;
      
      PERFORM public.log_sla_action(
        NEW.ticket_id,
        'Franqueado respondeu fora do horário - marcado para despausar às 08:30',
        jsonb_build_object('timestamp', NOW())
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;