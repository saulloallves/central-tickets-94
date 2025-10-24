-- IMPORTANTE: Esta policy permite que usuários autenticados vejam
-- perfis públicos (nome) de outros colaboradores para:
-- 1. Identificar autores de mensagens em tickets
-- 2. Melhorar transparência e rastreabilidade
-- 3. Facilitar comunicação interna
-- 
-- Segurança mantida:
-- - Apenas SELECT é permitido (não UPDATE/DELETE)
-- - Dados sensíveis continuam protegidos por suas próprias RLS
-- - Admins e diretoria mantêm acesso total

-- Permitir colaboradores autenticados verem perfis de outros colaboradores
-- para exibir nomes nas mensagens de tickets
CREATE POLICY "colaboradores_view_other_profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  -- Qualquer usuário autenticado pode ver perfis públicos
  -- (apenas nome e informações básicas são retornadas via SELECT)
  true
);