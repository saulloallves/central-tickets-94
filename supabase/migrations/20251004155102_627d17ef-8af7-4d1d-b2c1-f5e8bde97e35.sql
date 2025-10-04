-- Criar função RPC para verificar se email é pré-aprovado (para usuários não autenticados)
CREATE OR REPLACE FUNCTION public.check_email_pre_approved(email_check text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE email = email_check
      AND is_imported_user = true
  )
$$;