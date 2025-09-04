-- Limpeza forçada das notificações bugadas
-- Temporariamente desabilitar RLS para fazer limpeza
ALTER TABLE public.notifications_queue DISABLE ROW LEVEL SECURITY;

-- Marcar todas as notificações antigas como processadas
UPDATE public.notifications_queue 
SET status = 'processed', 
    processed_at = now()
WHERE status = 'pending' 
  AND created_at < now() - interval '6 hours';

-- Limpar notificações duplicadas de SLA
UPDATE public.notifications_queue 
SET status = 'processed', 
    processed_at = now()
WHERE status = 'pending' 
  AND type IN ('sla_half', 'sla_breach')
  AND created_at < now() - interval '1 hour';

-- Re-habilitar RLS
ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;

-- Atualizar políticas RLS para permitir limpeza automática
DROP POLICY IF EXISTS "System can clean notifications" ON public.notifications_queue;
CREATE POLICY "System can clean notifications"
  ON public.notifications_queue
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Executar limpeza imediata
SELECT public.cleanup_old_notifications();