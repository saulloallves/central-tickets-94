-- Passo 1: Garantir que todos os IDs estão preenchidos
UPDATE public.unidades 
SET id = old::uuid 
WHERE id IS NULL AND old IS NOT NULL;

-- Passo 2: Converter todas as colunas ANTES de mexer na tabela unidades
ALTER TABLE public.atendente_unidades DROP CONSTRAINT IF EXISTS atendente_unidades_id_fkey;
ALTER TABLE public.atendente_unidades DROP CONSTRAINT IF EXISTS atendente_unidades_unidade_id_fkey;
ALTER TABLE public.atendente_unidades ALTER COLUMN id TYPE UUID USING id::uuid;

-- Passo 3: Usar CASCADE para remover a coluna old e TODAS as suas dependências
ALTER TABLE public.unidades DROP COLUMN IF EXISTS old CASCADE;

-- Passo 4: Remover e recriar a chave primária
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unidades_pkey CASCADE;
ALTER TABLE public.unidades ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.unidades ADD CONSTRAINT unidades_pkey PRIMARY KEY (id);

-- Passo 5: Recriar apenas a foreign key essencial
ALTER TABLE public.atendente_unidades 
ADD CONSTRAINT atendente_unidades_unidade_id_fkey 
FOREIGN KEY (id) REFERENCES public.unidades(id) ON DELETE CASCADE;

-- Log
SELECT public.log_system_action(
  'sistema'::public.log_tipo,
  'unidades',
  'migration',
  'Migração UUID concluída - policies removidas com CASCADE',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object('version', 'cascade_v1'),
  'web'::public.log_canal
);