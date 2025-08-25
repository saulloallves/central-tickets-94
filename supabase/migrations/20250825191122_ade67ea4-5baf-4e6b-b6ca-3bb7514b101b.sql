-- Corrigir recursão infinita nas policies RLS
-- O problema é que algumas policies estão fazendo referência circular

-- Primeiro, remover as policies problemáticas existentes
DROP POLICY IF EXISTS "can_view_ticket" ON public.tickets;
DROP POLICY IF EXISTS "can_update_ticket" ON public.tickets;

-- Recriar as functions sem recursão
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Recriar policies da tabela tickets sem recursão
CREATE POLICY "Admins can view all tickets" ON public.tickets
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users with view_all_tickets permission can view all" ON public.tickets
  FOR SELECT USING (has_permission(auth.uid(), 'view_all_tickets'::app_permission));

CREATE POLICY "Supervisors can view tickets in their units" ON public.tickets
  FOR SELECT USING (
    has_role(auth.uid(), 'supervisor'::app_role) AND
    EXISTS (
      SELECT 1
      FROM franqueados f
      JOIN profiles p ON p.email = f.email
      WHERE p.id = auth.uid()
      AND f.unit_code ? tickets.unidade_id
    )
  );

CREATE POLICY "Team members can view tickets assigned to their team" ON public.tickets
  FOR SELECT USING (
    equipe_responsavel_id IS NOT NULL AND
    is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
  );

-- Policies para INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage all tickets" ON public.tickets
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create tickets in accessible units" ON public.tickets
  FOR INSERT WITH CHECK (can_create_ticket(unidade_id));

CREATE POLICY "Users can update tickets they can view" ON public.tickets
  FOR UPDATE USING (can_update_ticket(unidade_id, equipe_responsavel_id));

-- Criar bucket de avatars se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para storage.objects (avatars)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);