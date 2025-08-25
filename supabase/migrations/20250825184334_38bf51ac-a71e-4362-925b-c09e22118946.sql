-- Adicionar coluna normalizada para telefone na tabela franqueados
ALTER TABLE public.franqueados 
ADD COLUMN normalized_phone text GENERATED ALWAYS AS (regexp_replace(phone, '\D','','g')) STORED;

-- Criar índice para busca rápida por telefone normalizado
CREATE INDEX idx_franqueados_normalized_phone ON public.franqueados(normalized_phone);

-- Comentário para documentar a funcionalidade
COMMENT ON COLUMN public.franqueados.normalized_phone IS 'Telefone normalizado (apenas dígitos) para facilitar login e busca';