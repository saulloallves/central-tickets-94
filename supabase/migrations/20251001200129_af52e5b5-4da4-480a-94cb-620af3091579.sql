-- Adicionar coluna atendente_id na tabela atendente_unidades
ALTER TABLE public.atendente_unidades 
ADD COLUMN atendente_id UUID;

-- Criar foreign key para atendentes
ALTER TABLE public.atendente_unidades
ADD CONSTRAINT fk_atendente_unidades_atendente 
FOREIGN KEY (atendente_id) 
REFERENCES public.atendentes(id) 
ON DELETE SET NULL;

-- Migrar dados existentes: vincular por nome e telefone
UPDATE public.atendente_unidades au
SET atendente_id = a.id
FROM public.atendentes a
WHERE au.concierge_name = a.nome 
  AND au.concierge_phone = a.telefone
  AND a.tipo = 'concierge'
  AND a.ativo = true;

-- Criar índice para melhor performance
CREATE INDEX idx_atendente_unidades_atendente_id 
ON public.atendente_unidades(atendente_id);

-- Comentários para documentação
COMMENT ON COLUMN public.atendente_unidades.atendente_id IS 'Foreign key para atendentes.id - vincula a unidade com o atendente responsável';
COMMENT ON COLUMN public.atendente_unidades.concierge_name IS 'DEPRECATED: Use atendente_id. Mantido por compatibilidade';
COMMENT ON COLUMN public.atendente_unidades.concierge_phone IS 'DEPRECATED: Use atendente_id. Mantido por compatibilidade';