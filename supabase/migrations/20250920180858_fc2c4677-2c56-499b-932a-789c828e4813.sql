-- Marcar notificações antigas como processadas para parar o envio em massa
UPDATE public.notifications_queue 
SET status = 'processed', 
    processed_at = now() 
WHERE status = 'pending' 
  AND type IN ('sla_breach', 'sla_half') 
  AND created_at < now() - interval '2 hours';

-- Criar índice para melhorar performance das consultas por data
CREATE INDEX IF NOT EXISTS idx_notifications_queue_created_at_status 
ON public.notifications_queue(created_at, status) 
WHERE type IN ('sla_breach', 'sla_half');