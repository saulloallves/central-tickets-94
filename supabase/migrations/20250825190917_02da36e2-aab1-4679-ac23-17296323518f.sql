-- Criar trigger para criar perfil automaticamente quando usuário faz login
-- e trigger para atribuir role admin por padrão (temporário para resolver o problema)

CREATE OR REPLACE FUNCTION public.handle_auth_user_new()
RETURNS trigger AS $$
BEGIN
  -- Inserir perfil automaticamente
  INSERT INTO public.profiles (id, email, nome_completo, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Sistema'),
    now(),
    now()
  );
  
  -- Atribuir role admin por padrão (TEMPORÁRIO - remover em produção)
  INSERT INTO public.user_roles (user_id, role)
  VALUES 
    (NEW.id, 'admin'::app_role),
    (NEW.id, 'diretoria'::app_role);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_new();