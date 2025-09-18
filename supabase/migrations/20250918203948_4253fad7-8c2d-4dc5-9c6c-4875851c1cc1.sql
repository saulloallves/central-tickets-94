-- Criar um perfil padrão do sistema para o UUID fallback se não existir
INSERT INTO public.profiles (id, email, display_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'sistema@example.com', 'Sistema')
ON CONFLICT (id) DO NOTHING;

-- Verificar se existe alguma constraint de foreign key que está bloqueando
-- E temporariamente permitir que criado_por seja nullable se necessário
ALTER TABLE public.documentos ALTER COLUMN criado_por DROP NOT NULL;