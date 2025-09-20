-- Forçar limpeza das notificações SLA antigas para parar envios em massa
UPDATE public.notifications_queue 
SET status = 'processed', 
    processed_at = now(),
    updated_at = now()
WHERE status = 'pending' 
  AND type IN ('sla_breach', 'sla_half');