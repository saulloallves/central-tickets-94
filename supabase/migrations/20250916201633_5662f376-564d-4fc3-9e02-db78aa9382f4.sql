-- Adicionar coluna user_id na tabela atendentes
ALTER TABLE public.atendentes 
ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX idx_atendentes_user_id ON public.atendentes(user_id);

-- Atualizar registros existentes com as vinculações identificadas
-- Gabriel Rocha
UPDATE public.atendentes 
SET user_id = (
  SELECT id FROM public.profiles 
  WHERE email = 'gabriel.rocha@crescieperdi.com.br'
)
WHERE email = 'gabriel.rocha@crescieperdi.com.br';

-- Maria Débora  
UPDATE public.atendentes 
SET user_id = (
  SELECT id FROM public.profiles 
  WHERE email = 'maria.debora@crescieperdi.com.br'
)
WHERE email = 'maria.debora@crescieperdi.com.br';

-- Thamiris Arantes
UPDATE public.atendentes 
SET user_id = (
  SELECT id FROM public.profiles 
  WHERE email = 'thamiris.arantes@crescieperdi.com.br'
)
WHERE email = 'thamiris.arantes@crescieperdi.com.br';