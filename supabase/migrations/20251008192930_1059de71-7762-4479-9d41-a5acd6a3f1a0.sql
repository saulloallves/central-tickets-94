-- Remove o trigger genérico conflitante
DROP TRIGGER IF EXISTS trigger_create_internal_notification ON public.notifications_queue;

-- Remove a função genérica conflitante
DROP FUNCTION IF EXISTS public.create_internal_notification_from_queue();

-- Comentário: Os triggers específicos já existem e continuarão funcionando:
-- - create_internal_notification_on_ticket_created
-- - create_internal_notification_on_ticket_forwarded
-- - create_internal_notification_on_sla_breach
-- - create_internal_notification_on_sla_half
-- - create_internal_notification_on_ticket_assigned