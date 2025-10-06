-- Corrigir função sync_message_to_conversa para usar cast correto do UUID
DROP FUNCTION IF EXISTS sync_message_to_conversa() CASCADE;

CREATE OR REPLACE FUNCTION sync_message_to_conversa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor TEXT;
  v_msg_obj JSONB;
BEGIN
  -- Determinar autor baseado na direção
  IF NEW.direcao = 'entrada' THEN
    -- Buscar nome do franqueado pela unidade
    SELECT COALESCE(f.name, 'Franqueado')
    INTO v_autor
    FROM public.tickets t3
    LEFT JOIN public.unidades u ON t3.unidade_id = u.id
    LEFT JOIN public.franqueados f ON f.unit_code ? u.id::text  -- CORREÇÃO: cast UUID para text
    WHERE t3.id = NEW.ticket_id
    LIMIT 1;
    
    v_autor := COALESCE(v_autor, 'Franqueado');
  ELSIF NEW.direcao = 'saida' THEN
    v_autor := 'Suporte';
  ELSE
    v_autor := 'Sistema';
  END IF;

  -- Montar objeto da mensagem
  v_msg_obj := jsonb_build_object(
    'id', NEW.id,
    'autor', v_autor,
    'texto', NEW.mensagem,
    'timestamp', to_char(NEW.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'anexos', COALESCE(NEW.anexos, '[]'::jsonb)
  );

  -- Atualizar o campo conversa no ticket
  UPDATE public.tickets
  SET conversa = COALESCE(conversa, '[]'::jsonb) || v_msg_obj
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_sync_message_to_conversa ON ticket_mensagens;

CREATE TRIGGER trigger_sync_message_to_conversa
AFTER INSERT ON ticket_mensagens
FOR EACH ROW
EXECUTE FUNCTION sync_message_to_conversa();