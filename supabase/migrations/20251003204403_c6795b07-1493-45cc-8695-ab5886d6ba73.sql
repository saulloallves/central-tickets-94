-- Adicionar coluna para marcar usuários importados do franchising_members
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_imported_user BOOLEAN DEFAULT false;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_imported_user 
ON public.profiles(is_imported_user) 
WHERE is_imported_user = true;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.is_imported_user IS 'Indica se o usuário foi importado do sistema franchising_members e precisa configurar senha e equipe no primeiro acesso';