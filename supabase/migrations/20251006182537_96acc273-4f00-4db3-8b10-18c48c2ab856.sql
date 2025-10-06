-- Usar CASCADE para remover todas as dependências
ALTER TABLE public.tickets DROP COLUMN unidade_id CASCADE;

-- Adicionar coluna novamente como UUID
ALTER TABLE public.tickets ADD COLUMN unidade_id UUID;

-- Criar foreign key
ALTER TABLE public.tickets 
ADD CONSTRAINT tickets_unidade_id_fkey 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;

-- Log
SELECT public.log_system_action(
  'sistema'::public.log_tipo,
  'tickets',
  'migration',
  'ATENÇÃO: unidade_id foi recriada como UUID mas os dados existentes foram perdidos',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object('warning', 'data_loss'),
  'web'::public.log_canal
);