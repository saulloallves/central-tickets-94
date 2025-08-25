-- Trocar 'gerente' por 'supervisor' no enum primeiro
ALTER TYPE app_role RENAME VALUE 'gerente' TO 'supervisor';

-- Agora atualizar as funções que usavam gerente para supervisor
-- Primeiro remover a função com dependências usando CASCADE
DROP FUNCTION IF EXISTS public.can_update_ticket(text) CASCADE;

-- Recriar a função can_update_ticket correta
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      EXISTS (
        SELECT 1
        FROM franqueados f
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
        AND f.unit_code ? ticket_unidade_id
      )
    ) OR
    (
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$function$;

-- Recriar as políticas que foram removidas com CASCADE e atualizar para 'supervisor'

-- Política para ai_feedback
CREATE POLICY "Supervisores view ai_feedback for manageable tickets" 
ON public.ai_feedback 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ai_feedback.ticket_id) AND public.can_update_ticket(t.unidade_id))));

-- Política para ticket_ai_interactions  
CREATE POLICY "Users can update AI interactions for manageable tickets" 
ON public.ticket_ai_interactions 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_ai_interactions.ticket_id) AND public.can_update_ticket(t.unidade_id))));

-- Política para knowledge_article_usage
CREATE POLICY "Supervisores view knowledge_article_usage for manageable tickets" 
ON public.knowledge_article_usage 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = knowledge_article_usage.ticket_id) AND public.can_update_ticket(t.unidade_id))));

-- Política para crises_ativas
CREATE POLICY "Supervisores view crises_ativas for manageable tickets" 
ON public.crises_ativas 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = crises_ativas.ticket_id) AND public.can_update_ticket(t.unidade_id))));

-- Política para tickets
CREATE POLICY "Supervisores can create tickets in their units" 
ON public.tickets 
FOR INSERT 
WITH CHECK (can_create_ticket(unidade_id));

-- Atualizar função can_create_ticket para usar 'supervisor'
CREATE OR REPLACE FUNCTION public.can_create_ticket(ticket_unidade_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id
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