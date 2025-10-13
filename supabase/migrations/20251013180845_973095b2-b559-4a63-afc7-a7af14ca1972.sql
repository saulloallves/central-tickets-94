-- =====================================================
-- MIGRAÇÃO: SLA Pausado por Mensagens
-- Data: 2025
-- Descrição: Implementa pausa automática do SLA quando 
--            suporte envia mensagem (aguardando franqueado)
-- =====================================================

-- 1. Adicionar coluna para controlar pausa por mensagem
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS sla_pausado_mensagem BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.tickets.sla_pausado_mensagem IS 
'Indica se o SLA está pausado aguardando resposta do franqueado';

-- 2. Adicionar tipo de pausa na tabela de histórico
ALTER TABLE public.pausas_sla 
ADD COLUMN IF NOT EXISTS tipo_pausa TEXT DEFAULT 'horario_comercial';

COMMENT ON COLUMN public.pausas_sla.tipo_pausa IS 
'Tipo de pausa: horario_comercial (prioridade), aguardando_franqueado, manual';

-- 3. Atualizar pausas existentes com tipo padrão
UPDATE public.pausas_sla 
SET tipo_pausa = 'horario_comercial'
WHERE tipo_pausa IS NULL;

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_pausas_sla_tipo_ativo 
ON public.pausas_sla(ticket_id, tipo_pausa, pausa_fim);

-- 5. Função para gerenciar pausa por mensagem
CREATE OR REPLACE FUNCTION public.gerenciar_pausa_sla_por_mensagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ticket_status ticket_status;
  ticket_sla_pausado BOOLEAN;
BEGIN
  -- Ignorar mensagens internas
  IF NEW.direcao = 'interna' THEN
    RETURN NEW;
  END IF;
  
  -- Buscar status e pausa por horário do ticket
  SELECT status, sla_pausado 
  INTO ticket_status, ticket_sla_pausado
  FROM tickets
  WHERE id = NEW.ticket_id;
  
  -- Só processar tickets ativos
  IF ticket_status NOT IN ('aberto', 'em_atendimento', 'escalonado') THEN
    RETURN NEW;
  END IF;
  
  -- REGRA 1: Mensagem de SAÍDA (suporte) → PAUSAR SLA
  -- Mas só se NÃO estiver pausado por horário (prioridade do horário)
  IF NEW.direcao = 'saida' THEN
    UPDATE public.tickets
    SET sla_pausado_mensagem = TRUE,
        updated_at = NOW()
    WHERE id = NEW.ticket_id 
      AND sla_pausado_mensagem = FALSE;
    
    -- Registrar pausa apenas se não estiver pausado por horário
    IF FOUND AND NOT ticket_sla_pausado THEN
      INSERT INTO public.pausas_sla (ticket_id, pausa_inicio, motivo, tipo_pausa)
      VALUES (NEW.ticket_id, NOW(), 'Aguardando resposta do franqueado', 'aguardando_franqueado');
      
      PERFORM public.log_sla_action(
        NEW.ticket_id,
        'SLA pausado - Aguardando resposta franqueado',
        jsonb_build_object('mensagem_id', NEW.id, 'tipo', 'aguardando_franqueado')
      );
    END IF;
  END IF;
  
  -- REGRA 2: Mensagem de ENTRADA (franqueado) → DESPAUSAR SLA
  IF NEW.direcao = 'entrada' THEN
    UPDATE public.tickets
    SET sla_pausado_mensagem = FALSE,
        updated_at = NOW()
    WHERE id = NEW.ticket_id 
      AND sla_pausado_mensagem = TRUE;
    
    -- Finalizar pausa por mensagem
    IF FOUND THEN
      UPDATE public.pausas_sla
      SET pausa_fim = NOW()
      WHERE ticket_id = NEW.ticket_id 
        AND tipo_pausa = 'aguardando_franqueado'
        AND pausa_fim IS NULL;
      
      PERFORM public.log_sla_action(
        NEW.ticket_id,
        'SLA despausado - Franqueado respondeu',
        jsonb_build_object('mensagem_id', NEW.id, 'tipo', 'franqueado_respondeu')
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 6. Criar trigger para executar a função
DROP TRIGGER IF EXISTS trigger_pausa_sla_mensagem ON public.ticket_mensagens;

CREATE TRIGGER trigger_pausa_sla_mensagem
  AFTER INSERT ON public.ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.gerenciar_pausa_sla_por_mensagem();

-- 7. Atualizar função de registrar pausa do horário para marcar tipo correto
CREATE OR REPLACE FUNCTION public.trigger_registrar_pausa_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se começou a pausar (FALSE -> TRUE) por HORÁRIO
  IF NEW.sla_pausado = TRUE AND (OLD.sla_pausado = FALSE OR OLD.sla_pausado IS NULL) THEN
    INSERT INTO pausas_sla (ticket_id, pausa_inicio, motivo, tipo_pausa)
    VALUES (NEW.id, NOW(), 'Pausa automática de SLA - Fora do horário', 'horario_comercial');
  END IF;
  
  -- Se retomou (TRUE -> FALSE) por HORÁRIO
  IF NEW.sla_pausado = FALSE AND OLD.sla_pausado = TRUE THEN
    UPDATE pausas_sla
    SET pausa_fim = NOW()
    WHERE ticket_id = NEW.id 
      AND tipo_pausa = 'horario_comercial'
      AND pausa_fim IS NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;