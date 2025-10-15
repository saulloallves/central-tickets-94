-- Corrigir função auto_pause_sla_on_outgoing_message para não atualizar coluna GENERATED

CREATE OR REPLACE FUNCTION auto_pause_sla_on_outgoing_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_business BOOLEAN;
BEGIN
  -- Mensagem de SAÍDA (suporte respondeu) → PAUSAR por mensagem
  IF NEW.direcao = 'saida' THEN
    UPDATE tickets
    SET 
      sla_pausado_mensagem = TRUE,
      sla_pausado_em = NOW(),
      sla_ultima_atualizacao = NOW()
    WHERE id = NEW.ticket_id
      AND sla_pausado_mensagem = FALSE;
    
    -- Registrar pausa
    INSERT INTO pausas_sla (ticket_id, pausa_inicio, motivo, tipo_pausa)
    SELECT NEW.ticket_id, NOW(), 'Aguardando resposta franqueado', 'aguardando_franqueado'
    WHERE NOT EXISTS (
      SELECT 1 FROM pausas_sla 
      WHERE ticket_id = NEW.ticket_id 
        AND tipo_pausa = 'aguardando_franqueado'
        AND pausa_fim IS NULL
    );
  
  -- Mensagem de ENTRADA (franqueado respondeu) → DESPAUSAR mensagem
  ELSIF NEW.direcao = 'entrada' THEN
    is_business := is_business_hours();
    
    -- ✅ CORREÇÃO: Não atualizar sla_pausado (coluna GENERATED)
    -- Apenas atualizar sla_pausado_mensagem
    UPDATE tickets
    SET 
      sla_pausado_mensagem = FALSE,
      sla_pausado_em = CASE 
        -- Se ainda estiver pausado por horário, manter timestamp
        WHEN sla_pausado_horario THEN sla_pausado_em
        -- Senão, limpar
        ELSE NULL 
      END,
      pode_despausar_as_0830 = CASE
        WHEN is_business THEN FALSE
        ELSE TRUE
      END,
      sla_ultima_atualizacao = NOW()
    WHERE id = NEW.ticket_id;
    
    -- Finalizar pausa de mensagem
    UPDATE pausas_sla
    SET pausa_fim = NOW()
    WHERE ticket_id = NEW.ticket_id 
      AND tipo_pausa = 'aguardando_franqueado'
      AND pausa_fim IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Log da correção
SELECT log_system_action(
  'sistema'::log_tipo,
  'database',
  'auto_pause_sla_on_outgoing_message',
  'Corrigido trigger para não atualizar coluna GENERATED sla_pausado',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object('fix', 'removed_sla_pausado_direct_update', 'now_uses', 'sla_pausado_mensagem'),
  'painel_interno'::log_canal
);