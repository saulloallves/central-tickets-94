-- Recriar triggers que foram removidos acidentalmente (apenas os que não existem)

-- Drop e recria todos os triggers para garantir consistência
DROP TRIGGER IF EXISTS trigger_create_internal_notification_ticket_created ON public.notifications_queue;
DROP TRIGGER IF EXISTS trigger_create_internal_notification_sla_breach ON public.notifications_queue;
DROP TRIGGER IF EXISTS trigger_create_internal_notification_sla_half ON public.notifications_queue;
DROP TRIGGER IF EXISTS trigger_create_internal_notification_ticket_assigned ON public.notifications_queue;

-- Recriar todos os triggers
CREATE TRIGGER trigger_create_internal_notification_ticket_created
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.create_internal_notification_on_ticket_created();

CREATE TRIGGER trigger_create_internal_notification_sla_breach
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.create_internal_notification_on_sla_breach();

CREATE TRIGGER trigger_create_internal_notification_sla_half
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.create_internal_notification_on_sla_half();

CREATE TRIGGER trigger_create_internal_notification_ticket_assigned
  AFTER INSERT ON public.notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.create_internal_notification_on_ticket_assigned();