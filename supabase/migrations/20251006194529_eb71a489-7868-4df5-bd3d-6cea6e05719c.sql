-- Corrigir tipo do campo franqueado_id na tabela tickets
-- De bigint para uuid para compatibilidade com a tabela franqueados

-- Primeiro, remover a coluna codigo_grupo se existir (era bigint e não é mais necessária)
ALTER TABLE public.tickets DROP COLUMN IF EXISTS codigo_grupo;

-- Adicionar nova coluna franqueado_id com tipo uuid (temporária)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS franqueado_id_new uuid;

-- Copiar dados convertíveis (se houver algum dado válido)
-- Como são tipos incompatíveis, vamos apenas criar a nova coluna vazia

-- Remover a coluna antiga franqueado_id
ALTER TABLE public.tickets DROP COLUMN IF EXISTS franqueado_id;

-- Renomear a nova coluna
ALTER TABLE public.tickets RENAME COLUMN franqueado_id_new TO franqueado_id;

-- Adicionar foreign key para franqueados
ALTER TABLE public.tickets 
ADD CONSTRAINT tickets_franqueado_id_fkey 
FOREIGN KEY (franqueado_id) 
REFERENCES public.franqueados(id) 
ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_tickets_franqueado_id ON public.tickets(franqueado_id);