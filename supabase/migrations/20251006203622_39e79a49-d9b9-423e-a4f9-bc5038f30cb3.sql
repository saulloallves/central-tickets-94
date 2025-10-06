-- Corrigir função log_ticket_mensagens_errors adicionando SET search_path
CREATE OR REPLACE FUNCTION log_ticket_mensagens_errors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE LOG 'Tentativa de INSERT em ticket_mensagens - ticket_id: %, usuario_id: %, auth.uid: %',
    NEW.ticket_id, NEW.usuario_id, auth.uid();
  RETURN NEW;
END;
$$;