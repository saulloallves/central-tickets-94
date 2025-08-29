-- Remove duplicate trigger that is causing message duplication in JSON conversa field
DROP TRIGGER IF EXISTS trigger_sync_message_to_conversa ON public.ticket_mensagens;