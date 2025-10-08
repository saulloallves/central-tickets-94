-- Corrigir erro de operador na função sync_message_to_conversa
-- O problema está na linha que busca o franqueado usando operador ? (JSONB) ao invés de JOIN correto

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
    -- Opção 1: nome via profiles.display_name
    SELECT COALESCE(p.display_name, p.email)
      INTO v_autor
      FROM public.profiles p
     WHERE p.id = NEW.usuario_id;

    -- Opção 2: nome via franqueados.name
    IF v_autor IS NULL THEN
      SELECT f.name
        INTO v_autor
        FROM public.franqueados f
       WHERE f.email = (SELECT email FROM public.profiles WHERE id = NEW.usuario_id);
    END IF;

    -- Opção 3: nome via franqueados da unidade (CORRIGIDO - usar JOIN correto ao invés de operador ?)
    IF v_autor IS NULL THEN
      SELECT f.name
        INTO v_autor
        FROM public.tickets t3
        LEFT JOIN public.franqueados_unidades fu ON fu.unidade_id = t3.unidade_id
        LEFT JOIN public.franqueados f ON f.id = fu.franqueado_id
       WHERE t3.id = NEW.ticket_id AND f.name IS NOT NULL
       LIMIT 1;
    END IF;

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