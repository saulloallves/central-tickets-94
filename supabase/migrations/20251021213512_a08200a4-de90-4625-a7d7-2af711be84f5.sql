-- Estratégia 3: Otimizar funções RLS com STABLE e adicionar índices para performance

-- 1. Função has_role já está STABLE, mas garantir que está otimizada
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND approved = true
    LIMIT 1
  );
$$;

-- 2. Otimizar função is_active_member_of_equipe com SQL STABLE
CREATE OR REPLACE FUNCTION public.is_active_member_of_equipe(p_user_id uuid, p_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.equipe_members
    WHERE user_id = p_user_id
      AND equipe_id = p_equipe_id
      AND ativo = true
    LIMIT 1
  );
$$;

-- 3. Adicionar índices para melhorar performance das funções RLS
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup 
ON public.user_roles(user_id, role, approved) 
WHERE approved = true;

CREATE INDEX IF NOT EXISTS idx_equipe_members_lookup 
ON public.equipe_members(user_id, equipe_id, ativo) 
WHERE ativo = true;

-- 4. Adicionar índices para melhorar queries em tickets_with_sla_info
CREATE INDEX IF NOT EXISTS idx_tickets_id_status 
ON public.tickets(id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_unidade_status 
ON public.tickets(unidade_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_equipe_status 
ON public.tickets(equipe_responsavel_id, status) 
WHERE equipe_responsavel_id IS NOT NULL;

-- 5. Analisar tabelas para atualizar estatísticas do PostgreSQL
ANALYZE public.user_roles;
ANALYZE public.equipe_members;
ANALYZE public.profiles;
ANALYZE public.tickets;