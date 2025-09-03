
-- 1) Extensões nas tabelas existentes (reuso com novo conceito "Crises")

-- crises: equipe, assinatura do problema, contagem, ativo, resolução
ALTER TABLE public.crises
  ADD COLUMN IF NOT EXISTS equipe_id uuid,
  ADD COLUMN IF NOT EXISTS problem_signature text,
  ADD COLUMN IF NOT EXISTS similar_terms text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tickets_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- FK para equipes (ignora se já existir)
DO $$
BEGIN
  ALTER TABLE public.crises
    ADD CONSTRAINT crises_equipe_id_fkey
      FOREIGN KEY (equipe_id) REFERENCES public.equipes(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_crises_equipe_status ON public.crises (equipe_id, status);
CREATE INDEX IF NOT EXISTS idx_crises_problem_signature ON public.crises (problem_signature);

-- Garante no máximo 1 crise ativa por equipe para a mesma assinatura (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS crises_unique_active_problem_per_team
  ON public.crises (equipe_id, (lower(problem_signature)))
  WHERE is_active = true AND problem_signature IS NOT NULL;

-- crise_ticket_links: garantir unicidade crise_id + ticket_id e índices
DO $$
BEGIN
  ALTER TABLE public.crise_ticket_links
    ADD CONSTRAINT crise_ticket_links_unique UNIQUE (crise_id, ticket_id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_crise_ticket_links_ticket ON public.crise_ticket_links (ticket_id);
CREATE INDEX IF NOT EXISTS idx_crise_ticket_links_crise ON public.crise_ticket_links (crise_id);

-- 2) Trigger para manter tickets_count em crises
CREATE OR REPLACE FUNCTION public.trg_update_crise_ticket_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.crises
       SET tickets_count = tickets_count + 1,
           ultima_atualizacao = now()
     WHERE id = NEW.crise_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.crises
       SET tickets_count = GREATEST(tickets_count - 1, 0),
           ultima_atualizacao = now()
     WHERE id = OLD.crise_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER crise_ticket_links_after_insert
  AFTER INSERT ON public.crise_ticket_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_crise_ticket_count();
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER crise_ticket_links_after_delete
  AFTER DELETE ON public.crise_ticket_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_crise_ticket_count();
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 3) Realtime (para banner/modal e updates em tempo real)
ALTER TABLE public.crises REPLICA IDENTITY FULL;
ALTER TABLE public.crise_ticket_links REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crises;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crise_ticket_links;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 4) RLS: permitir que membros da equipe visualizem suas crises
-- (Mantém as políticas atuais de admin/diretoria para manage)
CREATE POLICY IF NOT EXISTS crises_equipe_members_select
  ON public.crises
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.equipe_members em
      WHERE em.equipe_id = crises.equipe_id
        AND em.user_id = auth.uid()
        AND em.ativo = true
    )
  );

-- Opcional: leitura de links por membros da equipe (além das políticas já existentes)
CREATE POLICY IF NOT EXISTS crise_ticket_links_equipe_members_select
  ON public.crise_ticket_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.crises c
      JOIN public.equipe_members em ON em.equipe_id = c.equipe_id
      WHERE c.id = crise_ticket_links.crise_id
        AND em.user_id = auth.uid()
        AND em.ativo = true
    )
  );
