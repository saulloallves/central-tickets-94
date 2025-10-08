-- Simplificar sync_message_to_conversa para buscar franqueado direto pelo franqueado_id
CREATE OR REPLACE FUNCTION public.sync_message_to_conversa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_autor TEXT;
BEGIN
  -- Determinar o autor da mensagem
  IF NEW.direcao = 'entrada' THEN
    -- Para mensagens de entrada: buscar franqueado pelo franqueado_id do ticket
    SELECT f.name
      INTO v_autor
      FROM public.tickets t
      JOIN public.franqueados f ON f.id = t.franqueado_id
     WHERE t.id = NEW.ticket_id;
    
    -- Se não encontrou (ticket sem franqueado_id), usar 'Franqueado' genérico
    v_autor := COALESCE(v_autor, 'Franqueado');

  ELSE
    -- Mensagem de saída (suporte/sistema)
    SELECT COALESCE(p.display_name, p.email, 'Suporte')
      INTO v_autor
      FROM public.profiles p
     WHERE p.id = NEW.usuario_id;
  END IF;

  -- Atualizar o campo conversa (JSON) no ticket
  UPDATE public.tickets
     SET conversa = COALESCE(conversa, '[]'::jsonb) || jsonb_build_object(
       'id', NEW.id,
       'autor', v_autor,
       'texto', NEW.mensagem,
       'timestamp', NEW.criado_em,
       'canal', NEW.canal,
       'direcao', NEW.direcao,
       'anexos', COALESCE(NEW.anexos, '[]'::jsonb)
     )::jsonb
   WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$function$;