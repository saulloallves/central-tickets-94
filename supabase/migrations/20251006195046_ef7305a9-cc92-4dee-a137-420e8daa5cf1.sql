-- Corrigir todas as referências de unidade_id de text para uuid

-- 1. Corrigir tabela colaboradores
ALTER TABLE public.colaboradores 
  ALTER COLUMN unidade_id TYPE uuid USING unidade_id::uuid;

-- Adicionar foreign key se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'colaboradores_unidade_id_fkey'
  ) THEN
    ALTER TABLE public.colaboradores
    ADD CONSTRAINT colaboradores_unidade_id_fkey
    FOREIGN KEY (unidade_id) 
    REFERENCES public.unidades(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Corrigir tabela escalation_levels
ALTER TABLE public.escalation_levels
  ALTER COLUMN unidade_id TYPE uuid USING unidade_id::uuid;

-- Adicionar foreign key se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'escalation_levels_unidade_id_fkey'
  ) THEN
    ALTER TABLE public.escalation_levels
    ADD CONSTRAINT escalation_levels_unidade_id_fkey
    FOREIGN KEY (unidade_id)
    REFERENCES public.unidades(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Recriar função can_create_ticket com uuid
DROP FUNCTION IF EXISTS public.can_create_ticket(text);

CREATE OR REPLACE FUNCTION public.can_create_ticket(ticket_unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id::text
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    ) OR
    -- Allow creation if user profile exists (fallback for authenticated users)
    (
      auth.uid() IS NOT NULL AND
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
    )
$function$;

-- 4. Recriar função can_update_ticket com uuid
DROP FUNCTION IF EXISTS public.can_update_ticket(text, uuid);

CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id uuid, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id::text
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    ) OR
    (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    )
$function$;

-- 5. Recriar função get_available_capacity com uuid
DROP FUNCTION IF EXISTS public.get_available_capacity(atendente_tipo, text);

CREATE OR REPLACE FUNCTION public.get_available_capacity(p_tipo atendente_tipo, p_unidade_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_capacity INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(a.capacidade_maxima - a.capacidade_atual), 0)
  INTO total_capacity
  FROM public.atendentes a
  JOIN public.atendente_unidades au ON a.id = au.atendente_id
  WHERE a.tipo = p_tipo
    AND a.status = 'ativo'
    AND a.ativo = true
    AND au.id = p_unidade_id
    AND au.ativo = true;
    
  RETURN COALESCE(total_capacity, 0);
END;
$function$;