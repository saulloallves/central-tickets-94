-- Criar trigger para notificar sobre novas solicitações de acesso interno
CREATE TRIGGER trigger_notify_internal_access_request
  AFTER INSERT ON public.internal_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_internal_access_request();