
-- 1) Função para gerentes verem unidades sem referenciar a tabela 'unidades'
CREATE OR REPLACE FUNCTION public.user_can_view_unidade(u_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'gerente'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.franqueados f
    JOIN public.profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
      AND f.unit_code ? u_id
  );
$$;

-- 2) Recriar a policy de gerentes em 'unidades' sem auto-referência
DROP POLICY IF EXISTS "Gerentes view managed unidades" ON public.unidades;

CREATE POLICY "Gerentes view managed unidades"
  ON public.unidades
  FOR SELECT
  USING ( public.user_can_view_unidade(id) );

-- 3) Atualizar can_view_ticket para não consultar 'unidades'
-- Versão: apenas unidade
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'view_all_tickets'::app_permission)
    OR (
      public.has_role(auth.uid(), 'gerente'::app_role) AND
      EXISTS (
        SELECT 1
        FROM public.franqueados f
        JOIN public.profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
          AND f.unit_code ? ticket_unidade_id
      )
    )
    OR (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM public.colaboradores c
        JOIN public.profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    );
$function$;

-- Versão: unidade + equipe
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'view_all_tickets'::app_permission)
    OR (
      public.has_role(auth.uid(), 'gerente'::app_role) AND
      EXISTS (
        SELECT 1
        FROM public.franqueados f
        JOIN public.profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
          AND f.unit_code ? ticket_unidade_id
      )
    )
    OR (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM public.colaboradores c
        JOIN public.profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    )
    OR (
      ticket_equipe_id IS NOT NULL
      AND public.is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    );
$function$;

-- 4) Atualizar can_update_ticket para não consultar 'unidades'
-- Versão: apenas unidade
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'view_all_tickets'::app_permission)
    OR (
      public.has_role(auth.uid(), 'gerente'::app_role) AND
      EXISTS (
        SELECT 1
        FROM public.franqueados f
        JOIN public.profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
          AND f.unit_code ? ticket_unidade_id
      )
    );
$function$;

-- Versão: unidade + equipe
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'view_all_tickets'::app_permission)
    OR (
      public.has_role(auth.uid(), 'gerente'::app_role) AND
      EXISTS (
        SELECT 1
        FROM public.franqueados f
        JOIN public.profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
          AND f.unit_code ? ticket_unidade_id
      )
    )
    OR (
      ticket_equipe_id IS NOT NULL
      AND public.is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    );
$function$;
