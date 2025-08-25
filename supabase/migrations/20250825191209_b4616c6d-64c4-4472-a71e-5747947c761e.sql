-- Remover todas as policies existentes da tabela tickets
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users with view_all_tickets permission can view all" ON public.tickets;
DROP POLICY IF EXISTS "Supervisors can view tickets in their units" ON public.tickets;
DROP POLICY IF EXISTS "Team members can view tickets assigned to their team" ON public.tickets;
DROP POLICY IF EXISTS "Users can create tickets in accessible units" ON public.tickets;
DROP POLICY IF EXISTS "Users can update tickets they can view" ON public.tickets;

-- Remover policies problemáticas (se existirem)
DROP POLICY IF EXISTS "can_view_ticket" ON public.tickets;
DROP POLICY IF EXISTS "can_update_ticket" ON public.tickets;

-- Criar policies simples e específicas sem recursão
CREATE POLICY "tickets_admin_all" ON public.tickets
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tickets_select_admin" ON public.tickets
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tickets_select_diretoria" ON public.tickets
  FOR SELECT USING (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "tickets_select_view_all_permission" ON public.tickets
  FOR SELECT USING (has_permission(auth.uid(), 'view_all_tickets'::app_permission));

-- Criar bucket de avatars se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Remover policies de storage existentes
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Criar policies simplificadas para storage
CREATE POLICY "public_avatar_access" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "authenticated_avatar_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "authenticated_avatar_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "authenticated_avatar_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND 
    auth.uid() IS NOT NULL
  );