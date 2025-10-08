-- Adicionar coluna display_name na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Preencher com dados existentes de nome_completo
UPDATE public.profiles 
SET display_name = nome_completo 
WHERE display_name IS NULL AND nome_completo IS NOT NULL;