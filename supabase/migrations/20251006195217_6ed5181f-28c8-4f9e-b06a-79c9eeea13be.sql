-- Corrigir todas as funções que usam unit_code ? uuid
-- O operador ? do JSONB precisa de text, então devemos converter uuid::text

-- 1. Corrigir can_create_ticket
DROP FUNCTION IF EXISTS public.can_create_ticket(uuid);

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
    (
      auth.uid() IS NOT NULL AND
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
    )
$function$;

-- 2. Corrigir can_update_ticket
DROP FUNCTION IF EXISTS public.can_update_ticket(uuid, uuid);

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

-- 3. Verificar e corrigir can_view_ticket se existir
DROP FUNCTION IF EXISTS public.can_view_ticket(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_view_ticket(uuid);

CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id uuid, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'diretoria'::app_role) OR
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