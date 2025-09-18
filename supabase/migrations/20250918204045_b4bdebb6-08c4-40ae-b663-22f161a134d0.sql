-- Permitir que criado_por seja nullable para resolver problemas de foreign key
ALTER TABLE public.documentos ALTER COLUMN criado_por DROP NOT NULL;

-- Verificar se há alguma constraint de foreign key desnecessária na tabela documentos
-- que está impedindo a criação de documentos sem usuário autenticado