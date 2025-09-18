-- Criar um perfil padrão do sistema para o UUID fallback se não existir
INSERT INTO public.profiles (id, email, nome_completo)
VALUES ('00000000-0000-0000-0000-000000000000', 'sistema@crescieperdi.com', 'Sistema Cresci e Perdi')
ON CONFLICT (id) DO NOTHING;

-- Temporariamente permitir que criado_por seja nullable para resolver problemas de foreign key
ALTER TABLE public.documentos ALTER COLUMN criado_por DROP NOT NULL;