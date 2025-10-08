-- Primeiro, verificar e remover duplicatas existentes mantendo apenas a mais recente
DELETE FROM public.notifications_queue a
USING public.notifications_queue b
WHERE a.id < b.id
  AND a.ticket_id = b.ticket_id
  AND a.type = b.type
  AND a.ticket_id IS NOT NULL;

-- Criar índice único parcial para (ticket_id, type) quando ticket_id não é nulo
-- Isso permite múltiplas notificações sem ticket_id, mas evita duplicatas quando há ticket_id
CREATE UNIQUE INDEX notifications_queue_ticket_type_unique 
ON public.notifications_queue (ticket_id, type)
WHERE ticket_id IS NOT NULL;

-- Log da operação
SELECT public.log_system_action(
  'sistema'::public.log_tipo,
  'notifications_queue',
  'index_added',
  'Adicionado índice único para (ticket_id, type)',
  NULL,
  NULL, NULL, NULL, NULL,
  jsonb_build_object('index', 'notifications_queue_ticket_type_unique'),
  'web'::public.log_canal
);