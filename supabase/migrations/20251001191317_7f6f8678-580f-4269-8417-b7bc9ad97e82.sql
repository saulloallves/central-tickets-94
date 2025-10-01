-- Adicionar colunas para informações da unidade e concierge na tabela atendente_unidades
ALTER TABLE public.atendente_unidades
ADD COLUMN IF NOT EXISTS grupo text,
ADD COLUMN IF NOT EXISTS codigo_grupo text,
ADD COLUMN IF NOT EXISTS concierge_name text,
ADD COLUMN IF NOT EXISTS concierge_phone text;

-- Adicionar índice para melhorar performance de buscas por codigo_grupo
CREATE INDEX IF NOT EXISTS idx_atendente_unidades_codigo_grupo ON public.atendente_unidades(codigo_grupo);

-- Comentários para documentação
COMMENT ON COLUMN public.atendente_unidades.grupo IS 'Nome da franquia/unidade';
COMMENT ON COLUMN public.atendente_unidades.codigo_grupo IS 'Código da franquia/unidade';
COMMENT ON COLUMN public.atendente_unidades.concierge_name IS 'Nome do atendente concierge';
COMMENT ON COLUMN public.atendente_unidades.concierge_phone IS 'Telefone do atendente concierge';