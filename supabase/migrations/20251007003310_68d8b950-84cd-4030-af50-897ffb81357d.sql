-- Alterar tipo da coluna unidade_id de text para uuid na tabela chamados
-- Primeiro, precisamos converter os dados existentes se houver

-- Se houver dados, tentar converter para UUID (se forem UUIDs válidos)
-- Se não forem UUIDs válidos, você pode precisar limpar os dados antes

-- Alterar a coluna para UUID
ALTER TABLE public.chamados 
  ALTER COLUMN unidade_id TYPE uuid USING unidade_id::uuid;