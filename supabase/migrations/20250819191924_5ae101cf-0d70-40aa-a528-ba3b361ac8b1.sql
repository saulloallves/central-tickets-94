-- Verificar se existem configurações de notificação
DO $$
BEGIN
  -- Se não existir nenhuma configuração, criar uma entrada padrão
  IF NOT EXISTS (SELECT 1 FROM notification_settings LIMIT 1) THEN
    INSERT INTO notification_settings (
      webhook_saida,
      numero_remetente,
      delay_mensagem,
      limite_retentativas,
      modelo_mensagem_sla
    ) VALUES (
      'https://api.z-api.io/instances/YOUR_INSTANCE/token/YOUR_TOKEN/send-text',
      '5511999999999',
      2000,
      3,
      'Olá! Este é um lembrete sobre o ticket #{codigo_ticket}. Status atual: {status}. Prioridade: {prioridade}.'
    );
    
    RAISE NOTICE 'Configurações padrão de notificação criadas com sucesso';
  ELSE
    RAISE NOTICE 'Configurações de notificação já existem';
  END IF;
END
$$;