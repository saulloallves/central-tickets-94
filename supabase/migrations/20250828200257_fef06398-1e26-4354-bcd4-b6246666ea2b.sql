
-- 1) Coluna JSON para a conversa consolidada
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS conversa jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Backfill: consolidar histórico existente de ticket_mensagens no JSON
-- Observação: ordena por created_at ASC para manter a timeline correta.
UPDATE public.tickets t
SET conversa = COALESCE((
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'autor',
          CASE
            WHEN m.direcao = 'saida' THEN 'suporte'
            WHEN m.direcao = 'entrada' THEN 'franqueado'
            ELSE 'interno'
          END,
        'texto', m.mensagem,
        'timestamp', m.created_at,
        'canal', m.canal
      )
      ORDER BY m.created_at ASC
    ),
    '[]'::jsonb
  )
  FROM public.ticket_mensagens m
  WHERE m.ticket_id = t.id
), '[]'::jsonb)
WHERE (t.conversa IS NULL OR t.conversa = '[]'::jsonb);

-- 3) Trigger para manter tickets.conversa sincronizado quando novas mensagens forem inseridas
CREATE OR REPLACE FUNCTION public.sync_message_to_conversa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_autor text;
  v_msg jsonb;
BEGIN
  -- Determina o "autor" no modelo do JSON
  v_autor := CASE
    WHEN NEW.direcao = 'saida' THEN 'suporte'
    WHEN NEW.direcao = 'entrada' THEN 'franqueado'
    ELSE 'interno'
  END;

  -- Monta o objeto da mensagem para o JSON
  v_msg := jsonb_build_object(
    'autor', v_autor,
    'texto', NEW.mensagem,
    'timestamp', NEW.created_at,
    'canal', NEW.canal
  );

  -- Append no JSON da conversa
  UPDATE public.tickets
     SET conversa = COALESCE(conversa, '[]'::jsonb) || jsonb_build_array(v_msg)
   WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$fn$;

-- Cria (ou recria) o gatilho
DROP TRIGGER IF EXISTS trg_sync_message_to_conversa ON public.ticket_mensagens;
CREATE TRIGGER trg_sync_message_to_conversa
AFTER INSERT ON public.ticket_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.sync_message_to_conversa();

-- 4) Função segura para append atômico (insere na tabela + atualiza JSON)
-- Usa SECURITY DEFINER para garantir funcionamento com RLS.
-- Quando chamada por usuários do app, verifica permissão via can_update_ticket.
CREATE OR REPLACE FUNCTION public.append_to_ticket_conversa(
  p_ticket_id uuid,
  p_autor text,            -- 'franqueado' | 'suporte' | 'interno'
  p_texto text,
  p_canal public.canal_resposta DEFAULT 'web',
  p_usuario_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_ticket record;
  v_direcao public.mensagem_direcao;
  v_conversa jsonb;
BEGIN
  -- Busca dados do ticket para checagem de permissão contextual
  SELECT id, unidade_id, equipe_responsavel_id
    INTO v_ticket
    FROM public.tickets
   WHERE id = p_ticket_id;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket % não encontrado', p_ticket_id;
  END IF;

  -- Se a função for chamada por usuário autenticado (app), aplica regra de permissão
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.can_update_ticket(v_ticket.unidade_id, v_ticket.equipe_responsavel_id) THEN
      RAISE EXCEPTION 'Sem permissão para atualizar este ticket';
    END IF;
  END IF;

  -- Mapeia autor -> direcao para manter consistência no relacional
  v_direcao := CASE
    WHEN lower(p_autor) = 'suporte' THEN 'saida'
    WHEN lower(p_autor) = 'franqueado' THEN 'entrada'
    ELSE 'interna'
  END;

  -- Insere no modelo relacional (dispara logs e mantém integrações)
  INSERT INTO public.ticket_mensagens (ticket_id, usuario_id, mensagem, direcao, canal)
  VALUES (p_ticket_id, COALESCE(p_usuario_id, auth.uid()), p_texto, v_direcao, p_canal);

  -- O trigger AFTER INSERT fará o append no JSON automaticamente.
  -- Ainda assim, retornamos a conversa atualizada para conveniência.
  SELECT conversa INTO v_conversa
    FROM public.tickets
   WHERE id = p_ticket_id;

  RETURN COALESCE(v_conversa, '[]'::jsonb);
END;
$fn$;

-- 5) Função utilitária para ler o JSON (útil para Edge Functions)
CREATE OR REPLACE FUNCTION public.get_ticket_conversa(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(conversa, '[]'::jsonb)
    FROM public.tickets
   WHERE id = p_ticket_id;
$fn$;
