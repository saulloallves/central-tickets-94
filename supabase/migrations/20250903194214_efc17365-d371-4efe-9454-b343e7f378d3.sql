-- Permitir usuários não autenticados a visualizar equipes ativas para o cadastro
DROP POLICY IF EXISTS "Authenticated users can view active equipes" ON public.equipes;

CREATE POLICY "Users can view active equipes for signup" 
ON public.equipes 
FOR SELECT 
USING (ativo = true);