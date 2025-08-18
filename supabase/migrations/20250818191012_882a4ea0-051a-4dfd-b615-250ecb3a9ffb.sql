
-- 1) Tipos (Enums) -----------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_media_type') THEN
    CREATE TYPE knowledge_media_type AS ENUM ('texto', 'video', 'pdf', 'link');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_model_provider') THEN
    CREATE TYPE ai_model_provider AS ENUM ('openai', 'lambda');
  END IF;
END$$;

-- 2) Expandir knowledge_articles --------------------------------------------

ALTER TABLE public.knowledge_articles
  ADD COLUMN IF NOT EXISTS tipo_midia knowledge_media_type DEFAULT 'texto',
  ADD COLUMN IF NOT EXISTS link_arquivo text,
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usado_pela_ia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_positivo integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_negativo integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_articles_criado_por_fkey'
  ) THEN
    ALTER TABLE public.knowledge_articles
      ADD CONSTRAINT knowledge_articles_criado_por_fkey
      FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 3) knowledge_suggestions (fila de sugestões para a base) -------------------

CREATE TABLE IF NOT EXISTS public.knowledge_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  texto_sugerido text NOT NULL,
  modelo_provedor ai_model_provider NOT NULL DEFAULT 'openai',
  modelo_nome text,
  sugerido_por uuid REFERENCES public.profiles(id),
  avaliado_por uuid REFERENCES public.profiles(id),
  publicado_em timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS: Admin gerencia tudo
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='knowledge_suggestions'
      AND policyname='Admins manage knowledge_suggestions'
  ) THEN
    CREATE POLICY "Admins manage knowledge_suggestions"
      ON public.knowledge_suggestions
      FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END
$policy$;

-- RLS: Gerentes podem visualizar
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='knowledge_suggestions'
      AND policyname='Gerentes can view knowledge_suggestions'
  ) THEN
    CREATE POLICY "Gerentes can view knowledge_suggestions"
      ON public.knowledge_suggestions
      FOR SELECT
      USING (has_role(auth.uid(), 'gerente'::app_role));
  END IF;
END
$policy$;

-- RLS: Usuários podem inserir e ver suas próprias sugestões
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='knowledge_suggestions'
      AND policyname='Users can insert knowledge_suggestions'
  ) THEN
    CREATE POLICY "Users can insert knowledge_suggestions"
      ON public.knowledge_suggestions
      FOR INSERT
      WITH CHECK (auth.uid() = sugerido_por);
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='knowledge_suggestions'
      AND policyname='Users can view their own knowledge_suggestions'
  ) THEN
    CREATE POLICY "Users can view their own knowledge_suggestions"
      ON public.knowledge_suggestions
      FOR SELECT
      USING (auth.uid() = sugerido_por);
  END IF;
END
$policy$;

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'knowledge_suggestions_set_updated_at'
  ) THEN
    CREATE TRIGGER knowledge_suggestions_set_updated_at
      BEFORE UPDATE ON public.knowledge_suggestions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 4) ai_feedback (feedback operacional ao concluir ticket) -------------------

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  interaction_id uuid REFERENCES public.ticket_ai_interactions(id) ON DELETE SET NULL,
  util boolean NOT NULL,
  motivo text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Admin gerencia tudo
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_feedback'
      AND policyname='Admins manage ai_feedback'
  ) THEN
    CREATE POLICY "Admins manage ai_feedback"
      ON public.ai_feedback
      FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END
$policy$;

-- Usuários inserem feedback para tickets que podem acessar
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_feedback'
      AND policyname='Users insert ai_feedback for accessible tickets'
  ) THEN
    CREATE POLICY "Users insert ai_feedback for accessible tickets"
      ON public.ai_feedback
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = ai_feedback.ticket_id
            AND can_view_ticket(t.unidade_id)
        )
        AND auth.uid() = created_by
      );
  END IF;
END
$policy$;

-- Usuários veem seu próprio feedback
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_feedback'
      AND policyname='Users view own ai_feedback'
  ) THEN
    CREATE POLICY "Users view own ai_feedback"
      ON public.ai_feedback
      FOR SELECT
      USING (auth.uid() = created_by);
  END IF;
END
$policy$;

-- Gerentes podem ver feedback dos tickets que gerenciam
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_feedback'
      AND policyname='Gerentes view ai_feedback for manageable tickets'
  ) THEN
    CREATE POLICY "Gerentes view ai_feedback for manageable tickets"
      ON public.ai_feedback
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = ai_feedback.ticket_id
            AND can_update_ticket(t.unidade_id)
        )
      );
  END IF;
END
$policy$;

-- 5) knowledge_article_usage (telemetria de artigos usados) ------------------

CREATE TABLE IF NOT EXISTS public.knowledge_article_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid REFERENCES public.ticket_ai_interactions(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  used_as text NOT NULL DEFAULT 'context', -- 'context' | 'forced'
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_article_usage ENABLE ROW LEVEL SECURITY;

-- Admin pode ver tudo
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='knowledge_article_usage'
      AND policyname='Admins view knowledge_article_usage'
  ) THEN
    CREATE POLICY "Admins view knowledge_article_usage"
      ON public.knowledge_article_usage
      FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END
$policy$;

-- Gerentes podem ver para tickets que gerenciam
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='knowledge_article_usage'
      AND policyname='Gerentes view knowledge_article_usage for manageable tickets'
  ) THEN
    CREATE POLICY "Gerentes view knowledge_article_usage for manageable tickets"
      ON public.knowledge_article_usage
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = knowledge_article_usage.ticket_id
            AND can_update_ticket(t.unidade_id)
        )
      );
  END IF;
END
$policy$;

-- 6) Trigger: ao inserir ai_feedback, atualizar contadores nos artigos -------

CREATE OR REPLACE FUNCTION public.update_kb_feedback_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.util = true THEN
    UPDATE public.knowledge_articles a
    SET feedback_positivo = feedback_positivo + sub.cnt
    FROM (
      SELECT article_id, COUNT(*)::int AS cnt
      FROM public.knowledge_article_usage
      WHERE ticket_id = NEW.ticket_id
      GROUP BY article_id
    ) sub
    WHERE a.id = sub.article_id;
  ELSE
    UPDATE public.knowledge_articles a
    SET feedback_negativo = feedback_negativo + sub.cnt
    FROM (
      SELECT article_id, COUNT(*)::int AS cnt
      FROM public.knowledge_article_usage
      WHERE ticket_id = NEW.ticket_id
      GROUP BY article_id
    ) sub
    WHERE a.id = sub.article_id;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ai_feedback_after_insert_update_kb_counts'
  ) THEN
    CREATE TRIGGER ai_feedback_after_insert_update_kb_counts
      AFTER INSERT ON public.ai_feedback
      FOR EACH ROW
      EXECUTE FUNCTION public.update_kb_feedback_counts();
  END IF;
END$$;

-- 7) Expandir faq_ai_settings para controles avançados -----------------------

ALTER TABLE public.faq_ai_settings
  ADD COLUMN IF NOT EXISTS allowed_categories text[],
  ADD COLUMN IF NOT EXISTS forced_article_ids uuid[],
  ADD COLUMN IF NOT EXISTS blocked_tags text[],
  ADD COLUMN IF NOT EXISTS use_only_approved boolean NOT NULL DEFAULT true;

-- 8) Views para relatórios ---------------------------------------------------

CREATE OR REPLACE VIEW public.v_kb_articles_usage AS
SELECT
  a.id AS article_id,
  a.titulo,
  a.categoria,
  a.aprovado,
  a.usado_pela_ia,
  COALESCE(COUNT(u.id), 0) AS usos_total,
  COALESCE(a.feedback_positivo, 0) AS feedback_positivo,
  COALESCE(a.feedback_negativo, 0) AS feedback_negativo
FROM public.knowledge_articles a
LEFT JOIN public.knowledge_article_usage u
  ON u.article_id = a.id
GROUP BY a.id;

CREATE OR REPLACE VIEW public.v_kb_resolution_rate AS
SELECT
  a.id AS article_id,
  a.titulo,
  SUM(CASE WHEN f.util THEN 1 ELSE 0 END) AS resolucoes_positivas,
  SUM(CASE WHEN f.util THEN 1 ELSE 0 END) AS resolucoes_negativas, -- soma de negativos
  CASE
    WHEN COUNT(f.id) > 0
    THEN SUM(CASE WHEN f.util THEN 1 ELSE 0 END)::decimal / COUNT(f.id)
    ELSE NULL
  END AS taxa_resolucao
FROM public.knowledge_articles a
LEFT JOIN public.knowledge_article_usage u
  ON u.article_id = a.id
LEFT JOIN public.ai_feedback f
  ON f.ticket_id = u.ticket_id
GROUP BY a.id;
