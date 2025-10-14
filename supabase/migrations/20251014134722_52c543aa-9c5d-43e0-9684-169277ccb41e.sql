-- Trigger para pausar SLA automaticamente quando suporte envia mensagem (aguardando resposta do cliente)
CREATE OR REPLACE FUNCTION auto_pause_sla_on_outgoing_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a mensagem é de SAÍDA (suporte respondeu ao cliente)
  IF NEW.direcao = 'saida' THEN
    UPDATE tickets
    SET 
      sla_pausado_mensagem = true,
      sla_pausado_em = NOW()
    WHERE id = NEW.ticket_id
      AND sla_pausado_mensagem = false; -- Só pausa se ainda não estiver pausado
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger que executa após inserir mensagem
CREATE TRIGGER trigger_auto_pause_sla_on_outgoing
  AFTER INSERT ON ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION auto_pause_sla_on_outgoing_message();

-- Corrigir os 2 tickets problemáticos identificados
UPDATE tickets
SET 
  sla_pausado_mensagem = true,
  sla_pausado_em = NOW()
WHERE codigo_ticket IN (
  'SÃO SEBASTIÃO DO PARAISO / MG-2025-0001',
  'LAURO DE FREITAS / BA-2025-0002'
)
AND sla_pausado_mensagem = false;