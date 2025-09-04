-- Remover o trigger problemático que usa o schema "net" não existente
DROP TRIGGER IF EXISTS trigger_process_notifications_auto ON public.notifications_queue;
DROP FUNCTION IF EXISTS public.process_notifications_trigger();