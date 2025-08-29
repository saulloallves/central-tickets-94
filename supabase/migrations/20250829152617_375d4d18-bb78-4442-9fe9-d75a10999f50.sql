-- Atualizar a função para usar "Franqueado" ao invés de "Cliente"
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

  -- Tenta obter o nome de diferentes formas:
  -- 1. Via tickets.criado_por -> profiles.nome_completo
  -- 2. Via NEW.usuario_id -> profiles.nome_completo  
  -- 3. Via franqueados baseado na unidade do ticket
  SELECT COALESCE(
    -- Opção 1: nome via criado_por
    (SELECT p1.nome_completo 
     FROM public.tickets t1
     LEFT JOIN public.profiles p1 ON p1.id = t1.criado_por
     WHERE t1.id = NEW.ticket_id AND p1.nome_completo IS NOT NULL),
    
    -- Opção 2: nome via usuario_id da mensagem
    (SELECT p2.nome_completo 
     FROM public.profiles p2 
     WHERE p2.id = NEW.usuario_id AND p2.nome_completo IS NOT NULL),
    
    -- Opção 3: nome via franqueados da unidade
    (SELECT f.name
     FROM public.tickets t3
     LEFT JOIN public.franqueados f ON f.unit_code ? t3.unidade_id
     WHERE t3.id = NEW.ticket_id AND f.name IS NOT NULL
     LIMIT 1)
  ) INTO v_nome_solicitante;

  -- Define o valor que irá no campo "autor" (exibição)
  v_autor := CASE
    WHEN v_autor_tipo = 'suporte' THEN 'Suporte'
    WHEN v_autor_tipo = 'franqueado' THEN COALESCE(NULLIF(TRIM(v_nome_solicitante), ''), 'Franqueado')
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