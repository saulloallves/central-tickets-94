
CREATE OR REPLACE FUNCTION public.sync_message_to_conversa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_autor_tipo text;
  v_autor text;
  v_nome_solicitante text;
  v_msg jsonb;
BEGIN
  -- Define o tipo do autor a partir da direcao
  v_autor_tipo := CASE
    WHEN NEW.direcao = 'saida' THEN 'suporte'
    WHEN NEW.direcao = 'entrada' THEN 'franqueado'
    ELSE 'interno'
  END;

  -- Tenta obter o nome de quem abriu o ticket (profiles.nome_completo via tickets.criado_por)
  SELECT p.nome_completo
    INTO v_nome_solicitante
    FROM public.tickets t
    LEFT JOIN public.profiles p ON p.id = t.criado_por
   WHERE t.id = NEW.ticket_id;

  -- Define o valor que irá no campo "autor" (exibição)
  v_autor := CASE
    WHEN v_autor_tipo = 'suporte' THEN 'Suporte'
    WHEN v_autor_tipo = 'franqueado' THEN COALESCE(NULLIF(TRIM(v_nome_solicitante), ''), 'Cliente')
    ELSE 'Interno'
  END;

  -- Monta o objeto da mensagem para o JSON
  v_msg := jsonb_build_object(
    'autor', v_autor,             -- nome exibido
    'autor_tipo', v_autor_tipo,   -- compatibilidade com a lógica atual do frontend
    'texto', NEW.mensagem,
    'timestamp', NEW.created_at,
    'canal', NEW.canal,
    'usuario_id', NEW.usuario_id
  );

  -- Append no JSON da conversa
  UPDATE public.tickets
     SET conversa = COALESCE(conversa, '[]'::jsonb) || jsonb_build_array(v_msg)
   WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$function$;
