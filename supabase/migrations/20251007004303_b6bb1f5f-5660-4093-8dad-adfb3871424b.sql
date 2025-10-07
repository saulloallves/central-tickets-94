-- Adicionar coluna para mapear ID externo das unidades
ALTER TABLE public.atendente_unidades 
  ADD COLUMN IF NOT EXISTS unidade_id_externo text;

-- Criar índice para melhorar performance nas buscas
CREATE INDEX IF NOT EXISTS idx_atendente_unidades_externo 
  ON public.atendente_unidades(unidade_id_externo);

-- Criar índice para busca por id_grupo_branco (usado no concierge_falar)
CREATE INDEX IF NOT EXISTS idx_atendente_unidades_grupo_branco 
  ON public.atendente_unidades(id_grupo_branco) 
  WHERE ativo = true;