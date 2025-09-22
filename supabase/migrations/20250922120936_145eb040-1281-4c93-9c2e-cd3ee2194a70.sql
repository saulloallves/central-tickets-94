-- Atualizar o provider_name da configuração Z-API para notificações
UPDATE public.messaging_providers 
SET provider_name = 'send_ticket_notification' 
WHERE provider_name = 'zapi_notifications' 
AND instance_id = '3E4305B20C51F0086DA02EE02AE98ECC';

-- Verificar se a configuração existe e ajustar também o ZAPIInstancesTab para usar o nome correto
-- Essa configuração é usada especificamente para envio de notificações de tickets