-- Adicionar coluna related_ticket_id na tabela internal_notifications
ALTER TABLE public.internal_notifications 
ADD COLUMN IF NOT EXISTS related_ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_internal_notifications_ticket 
ON public.internal_notifications(related_ticket_id);

-- Comentário explicativo
COMMENT ON COLUMN public.internal_notifications.related_ticket_id IS 'ID do ticket relacionado a esta notificação interna';