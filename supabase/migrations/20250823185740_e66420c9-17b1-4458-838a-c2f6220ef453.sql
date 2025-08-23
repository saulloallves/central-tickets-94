
-- 1) Adicionar chaves estrangeiras para o PostgREST reconhecer os relacionamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'internal_access_requests'
      AND constraint_name = 'internal_access_requests_equipe_id_fkey'
  ) THEN
    ALTER TABLE public.internal_access_requests
      ADD CONSTRAINT internal_access_requests_equipe_id_fkey
      FOREIGN KEY (equipe_id)
      REFERENCES public.equipes(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'internal_access_requests'
      AND constraint_name = 'internal_access_requests_user_id_fkey'
  ) THEN
    ALTER TABLE public.internal_access_requests
      ADD CONSTRAINT internal_access_requests_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(id)
      ON DELETE RESTRICT;
  END IF;
END$$;

-- 2) Trigger de updated_at na internal_access_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_internal_access_requests_updated_at'
  ) THEN
    CREATE TRIGGER set_internal_access_requests_updated_at
      BEFORE UPDATE ON public.internal_access_requests
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3) Garantir unicidade em equipe_members para permitir ON CONFLICT (equipe_id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'equipe_members'
      AND constraint_name = 'uq_equipe_members_equipe_user'
  ) THEN
    ALTER TABLE public.equipe_members
      ADD CONSTRAINT uq_equipe_members_equipe_user UNIQUE (equipe_id, user_id);
  END IF;
END$$;

-- 4) Índice único parcial (se ainda não existir) para evitar duplicidade de pendentes (mensagem 409)
-- Obs: se já existe "uq_iar_user_equipe_pending", deixamos como está
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_iar_user_equipe_pending'
  ) THEN
    CREATE UNIQUE INDEX uq_iar_user_equipe_pending
      ON public.internal_access_requests(user_id, equipe_id)
      WHERE status = 'pending';
  END IF;
END$$;

-- 5) Recriar/Consertar a função de aprovação
CREATE OR REPLACE FUNCTION public.approve_internal_access(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req RECORD;
BEGIN
  -- Apenas admins
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO req
  FROM public.internal_access_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Solicitação já processada (status=%)', req.status;
  END IF;

  -- Upsert no membership da equipe
  INSERT INTO public.equipe_members (equipe_id, user_id, role, ativo, is_primary)
  VALUES (req.equipe_id, req.user_id, req.desired_role, TRUE, FALSE)
  ON CONFLICT (equipe_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    ativo = TRUE,
    updated_at = now();

  -- Marcar solicitação como aprovada
  UPDATE public.internal_access_requests
  SET status = 'approved',
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- 6) Função de recusa
CREATE OR REPLACE FUNCTION public.reject_internal_access(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req RECORD;
BEGIN
  -- Apenas admins
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO req
  FROM public.internal_access_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Solicitação já processada (status=%)', req.status;
  END IF;

  UPDATE public.internal_access_requests
  SET status = 'rejected',
      comments = COALESCE(p_reason, comments),
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;
