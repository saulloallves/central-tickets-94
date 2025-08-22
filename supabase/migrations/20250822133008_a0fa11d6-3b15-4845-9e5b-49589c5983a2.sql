
-- 1) Tipo de status da Crise
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crise_status') THEN
    CREATE TYPE public.crise_status AS ENUM (
      'aberto',
      'investigando',
      'comunicado',
      'mitigado',
      'resolvido',
      'encerrado',
      'reaberto'
    );
  END IF;
END$$;

-- 2) Tabelas principais
CREATE TABLE IF NOT EXISTS public.crises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status public.crise_status NOT NULL DEFAULT 'aberto',
  palavras_chave TEXT[],
  canal_oficial TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  abriu_por UUID,
  ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crise_ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crise_id UUID NOT NULL REFERENCES public.crises(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by UUID,
  UNIQUE (crise_id, ticket_id)
);

CREATE TABLE IF NOT EXISTS public.crise_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crise_id UUID NOT NULL REFERENCES public.crises(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'info', -- ex: info | alerta | progresso | resolucao
  status public.crise_status,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- 3) RLS
ALTER TABLE public.crises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crise_ticket_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crise_updates ENABLE ROW LEVEL SECURITY;

-- Admin: manage all
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crises' AND policyname='crises_admin_manage') THEN
    CREATE POLICY "crises_admin_manage" ON public.crises
      FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crise_ticket_links' AND policyname='crise_ticket_links_admin_manage') THEN
    CREATE POLICY "crise_ticket_links_admin_manage" ON public.crise_ticket_links
      FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crise_updates' AND policyname='crise_updates_admin_manage') THEN
    CREATE POLICY "crise_updates_admin_manage" ON public.crise_updates
      FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;

-- Diretoria: SELECT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crises' AND policyname='crises_diretoria_view') THEN
    CREATE POLICY "crises_diretoria_view" ON public.crises
      FOR SELECT
      USING (has_role(auth.uid(), 'diretoria'::app_role));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crise_ticket_links' AND policyname='crise_ticket_links_diretoria_view') THEN
    CREATE POLICY "crise_ticket_links_diretoria_view" ON public.crise_ticket_links
      FOR SELECT
      USING (has_role(auth.uid(), 'diretoria'::app_role));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crise_updates' AND policyname='crise_updates_diretoria_view') THEN
    CREATE POLICY "crise_updates_diretoria_view" ON public.crise_updates
      FOR SELECT
      USING (has_role(auth.uid(), 'diretoria'::app_role));
  END IF;
END$$;

-- Usuários/Gerentes: SELECT condicionado ao acesso dos tickets vinculados
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crises' AND policyname='crises_view_by_ticket_access') THEN
    CREATE POLICY "crises_view_by_ticket_access" ON public.crises
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.crise_ticket_links ctl
          JOIN public.tickets t ON t.id = ctl.ticket_id
          WHERE ctl.crise_id = public.crises.id
            AND public.can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crise_ticket_links' AND policyname='crise_ticket_links_view_by_ticket_access') THEN
    CREATE POLICY "crise_ticket_links_view_by_ticket_access" ON public.crise_ticket_links
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = public.crise_ticket_links.ticket_id
            AND public.can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crise_updates' AND policyname='crise_updates_view_by_ticket_access') THEN
    CREATE POLICY "crise_updates_view_by_ticket_access" ON public.crise_updates
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.crise_ticket_links ctl
          JOIN public.tickets t ON t.id = ctl.ticket_id
          WHERE ctl.crise_id = public.crise_updates.crise_id
            AND public.can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
        )
      );
  END IF;
END$$;

-- 4) Índices
CREATE INDEX IF NOT EXISTS idx_crises_status ON public.crises(status);
CREATE INDEX IF NOT EXISTS idx_crise_links_ticket ON public.crise_ticket_links(ticket_id);
CREATE INDEX IF NOT EXISTS idx_crise_links_crise ON public.crise_ticket_links(crise_id);
CREATE INDEX IF NOT EXISTS idx_crise_updates_crise ON public.crise_updates(crise_id);

-- 5) Realtime (opcional porém recomendado)
ALTER TABLE public.crises REPLICA IDENTITY FULL;
ALTER TABLE public.crise_ticket_links REPLICA IDENTITY FULL;
ALTER TABLE public.crise_updates REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Pode falhar se já estiverem na publicação; por isso checamos
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='crises'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crises;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='crise_ticket_links'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crise_ticket_links;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='crise_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crise_updates;
  END IF;
END$$;

-- 6) Funções (RPC) núcleo Crise
CREATE OR REPLACE FUNCTION public.create_crise(
  p_titulo TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_palavras_chave TEXT[] DEFAULT NULL,
  p_ticket_ids UUID[] DEFAULT NULL,
  p_canal_oficial TEXT DEFAULT NULL,
  p_abriu_por UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_crise_id UUID;
  v_ticket_id UUID;
BEGIN
  INSERT INTO public.crises (titulo, descricao, palavras_chave, canal_oficial, abriu_por)
  VALUES (p_titulo, p_descricao, p_palavras_chave, p_canal_oficial, COALESCE(p_abriu_por, auth.uid()))
  RETURNING id INTO v_crise_id;

  IF p_ticket_ids IS NOT NULL THEN
    FOREACH v_ticket_id IN ARRAY p_ticket_ids LOOP
      INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
      VALUES (v_crise_id, v_ticket_id, COALESCE(p_abriu_por, auth.uid()))
      ON CONFLICT (crise_id, ticket_id) DO NOTHING;

      -- Opcional: elevar prioridade do ticket para 'crise'
      UPDATE public.tickets
      SET prioridade = 'crise'::ticket_prioridade,
          escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0), 5)
      WHERE id = v_ticket_id AND prioridade IS DISTINCT FROM 'crise'::ticket_prioridade;

      -- Notificação por ticket (reaproveita pipeline atual)
      INSERT INTO public.notifications_queue (ticket_id, type, payload)
      VALUES (v_ticket_id, 'crisis', jsonb_build_object('crise_id', v_crise_id, 'titulo', p_titulo))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Log
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'crises',
    v_crise_id::TEXT,
    'Crise criada',
    COALESCE(p_abriu_por, auth.uid()),
    NULL, NULL, NULL,
    NULL,
    jsonb_build_object('titulo', p_titulo, 'palavras_chave', p_palavras_chave, 'tickets', p_ticket_ids),
    'painel_interno'::public.log_canal
  );

  RETURN v_crise_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_tickets_to_crise(
  p_crise_id UUID,
  p_ticket_ids UUID[],
  p_by UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  FOREACH v_ticket_id IN ARRAY p_ticket_ids LOOP
    INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
    VALUES (p_crise_id, v_ticket_id, COALESCE(p_by, auth.uid()))
    ON CONFLICT (crise_id, ticket_id) DO NOTHING;

    UPDATE public.tickets
    SET prioridade = 'crise'::ticket_prioridade,
        escalonamento_nivel = GREATEST(COALESCE(escalonamento_nivel,0), 5)
    WHERE id = v_ticket_id AND prioridade IS DISTINCT FROM 'crise'::ticket_prioridade;

    INSERT INTO public.notifications_queue (ticket_id, type, payload)
    VALUES (v_ticket_id, 'crisis_update', jsonb_build_object('crise_id', p_crise_id, 'acao', 'link'))
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.crise_updates (crise_id, tipo, mensagem, created_by)
  VALUES (p_crise_id, 'info', 'Tickets vinculados à crise', COALESCE(p_by, auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_crise_status(
  p_crise_id UUID,
  p_status public.crise_status,
  p_mensagem TEXT DEFAULT NULL,
  p_by UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  UPDATE public.crises
    SET status = p_status, updated_at = now(), ultima_atualizacao = now()
  WHERE id = p_crise_id;

  INSERT INTO public.crise_updates (crise_id, tipo, status, mensagem, created_by)
  VALUES (p_crise_id, 'progresso', p_status, COALESCE(p_mensagem, 'Status atualizado'), COALESCE(p_by, auth.uid()));

  FOR v_ticket_id IN
    SELECT ticket_id FROM public.crise_ticket_links WHERE crise_id = p_crise_id
  LOOP
    INSERT INTO public.notifications_queue (ticket_id, type, payload)
    VALUES (v_ticket_id, 'crisis_update', jsonb_build_object('crise_id', p_crise_id, 'status', p_status, 'mensagem', p_mensagem))
    ON CONFLICT DO NOTHING;
  END LOOP;

  PERFORM public.log_system_action(
    'sistema'::public.log_tipo, 'crises', p_crise_id::TEXT, 'Crise status atualizado',
    COALESCE(p_by, auth.uid()), NULL, NULL, NULL, NULL,
    jsonb_build_object('status', p_status, 'mensagem', p_mensagem),
    'painel_interno'::public.log_canal
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_crise_message(
  p_crise_id UUID,
  p_mensagem TEXT,
  p_by UUID DEFAULT NULL,
  p_canal public.canal_resposta DEFAULT 'web'::public.canal_resposta
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  -- Guarda update na crise
  INSERT INTO public.crise_updates (crise_id, tipo, mensagem, created_by)
  VALUES (p_crise_id, 'alerta', p_mensagem, COALESCE(p_by, auth.uid()));

  FOR v_ticket_id IN
    SELECT ticket_id FROM public.crise_ticket_links WHERE crise_id = p_crise_id
  LOOP
    -- Registra mensagem no histórico do ticket
    INSERT INTO public.ticket_mensagens (ticket_id, direcao, mensagem, canal, usuario_id)
    VALUES (v_ticket_id, 'saida'::public.mensagem_direcao, p_mensagem, p_canal, COALESCE(p_by, auth.uid()));

    -- Notificação por ticket
    INSERT INTO public.notifications_queue (ticket_id, type, payload)
    VALUES (v_ticket_id, 'crisis_update', jsonb_build_object('crise_id', p_crise_id, 'mensagem', p_mensagem))
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_crise_close_tickets(
  p_crise_id UUID,
  p_mensagem TEXT DEFAULT 'Incidente resolvido. Encerramos este atendimento relacionado à crise.',
  p_status_ticket public.ticket_status DEFAULT 'concluido'::public.ticket_status,
  p_by UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  UPDATE public.crises
    SET status = 'encerrado'::public.crise_status, updated_at = now(), ultima_atualizacao = now()
  WHERE id = p_crise_id;

  INSERT INTO public.crise_updates (crise_id, tipo, status, mensagem, created_by)
  VALUES (p_crise_id, 'resolucao', 'encerrado', p_mensagem, COALESCE(p_by, auth.uid()));

  FOR v_ticket_id IN
    SELECT ticket_id FROM public.crise_ticket_links WHERE crise_id = p_crise_id
  LOOP
    UPDATE public.tickets
      SET status = p_status_ticket
    WHERE id = v_ticket_id AND status <> 'concluido'::public.ticket_status;

    INSERT INTO public.ticket_mensagens (ticket_id, direcao, mensagem, canal, usuario_id)
    VALUES (
      v_ticket_id,
      'saida'::public.mensagem_direcao,
      p_mensagem || ' (Ticket encerrado automaticamente via crise)',
      'web'::public.canal_resposta,
      COALESCE(p_by, auth.uid())
    );

    INSERT INTO public.notifications_queue (ticket_id, type, alert_level, payload)
    VALUES (v_ticket_id, 'crisis_resolved', 'critical', jsonb_build_object('crise_id', p_crise_id))
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 7) Detecção automática (trigger em tickets)
CREATE OR REPLACE FUNCTION public.detect_and_group_crise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_keywords TEXT[] := ARRAY[
    'travou tudo','não consigo vender','nao consigo vender','cliente xingando',
    'reclamação grave','reclamacao grave','ação judicial','acao judicial',
    'urgência máxima','urgencia maxima','ameaça','advogado','procon','trava total'
  ];
  v_match BOOLEAN := FALSE;
  v_count INT := 0;
  v_crise_id UUID;
  v_title TEXT;
BEGIN
  -- heurística de palavras-chave
  IF NEW.descricao_problema IS NOT NULL THEN
    FOR i IN array_lower(v_keywords,1)..array_upper(v_keywords,1) LOOP
      IF NEW.descricao_problema ILIKE '%' || v_keywords[i] || '%' THEN
        v_match := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- fallback por categoria em volume em 10min
  IF NOT v_match AND NEW.categoria IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.tickets t
    WHERE t.data_abertura >= now() - interval '10 minutes'
      AND t.categoria = NEW.categoria
      AND t.status <> 'concluido';
    IF v_count >= 3 THEN
      v_match := TRUE;
    END IF;
  END IF;

  IF v_match THEN
    -- tenta achar crise aberta similar na última 1h
    SELECT c.id
      INTO v_crise_id
    FROM public.crises c
    WHERE c.status IN ('aberto','investigando','comunicado','mitigado','reaberto')
      AND (
        (NEW.categoria IS NOT NULL AND c.palavras_chave @> ARRAY[NEW.categoria::text])
        OR EXISTS (
          SELECT 1
          FROM unnest(c.palavras_chave) pk
          WHERE NEW.descricao_problema ILIKE '%'||pk||'%'
        )
      )
      AND c.created_at >= now() - interval '60 minutes'
    ORDER BY c.updated_at DESC
    LIMIT 1;

    IF v_crise_id IS NULL THEN
      v_title := COALESCE(
        'Crise automática: ' || COALESCE(NEW.categoria::text, 'palavras-chave'),
        'Crise automática'
      );
      v_crise_id := public.create_crise(
        v_title,
        'Crise criada automaticamente por detecção',
        CASE 
          WHEN NEW.categoria IS NOT NULL THEN ARRAY[NEW.categoria::text]
          ELSE v_keywords
        END,
        ARRAY[NEW.id]::uuid[],
        NULL,
        auth.uid()
      );
    ELSE
      PERFORM public.add_tickets_to_crise(v_crise_id, ARRAY[NEW.id]::uuid[], auth.uid());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Anexa trigger (AFTER INSERT para já ter NEW.id)
DROP TRIGGER IF EXISTS trg_detect_and_group_crise ON public.tickets;
CREATE TRIGGER trg_detect_and_group_crise
AFTER INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.detect_and_group_crise();

-- 8) Migração opcional: portar crises_ativas não resolvidas para o novo modelo
-- (cria uma crise por registro existente e vincula o ticket correspondente)
INSERT INTO public.crises (titulo, descricao, status, palavras_chave, abriu_por, created_at, updated_at, ultima_atualizacao)
SELECT
  COALESCE('Crise migrada: ' || t.codigo_ticket, 'Crise migrada'),
  ca.motivo,
  'investigando'::public.crise_status,
  ARRAY[COALESCE(t.categoria::text, 'migrado')],
  ca.criada_por,
  ca.criada_em,
  now(),
  now()
FROM public.crises_ativas ca
JOIN public.tickets t ON t.id = ca.ticket_id
WHERE ca.resolvida_em IS NULL
ON CONFLICT DO NOTHING;

-- Vincular os tickets das crises migradas
INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by, linked_at)
SELECT c.id, t.id, ca.criada_por, now()
FROM public.crises c
JOIN public.tickets t ON TRUE
JOIN public.crises_ativas ca ON ca.ticket_id = t.id
WHERE ca.resolvida_em IS NULL
  AND c.titulo IN (COALESCE('Crise migrada: ' || t.codigo_ticket, 'Crise migrada'))
ON CONFLICT DO NOTHING;
