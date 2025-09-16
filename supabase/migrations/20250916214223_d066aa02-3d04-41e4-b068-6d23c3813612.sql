-- Verificar e corrigir REPLICA IDENTITY para a tabela chamados
DO $$
BEGIN
    -- Alterar REPLICA IDENTITY para FULL para garantir que todos os dados estejam disponíveis
    ALTER TABLE public.chamados REPLICA IDENTITY FULL;
    
    RAISE NOTICE 'REPLICA IDENTITY configurado como FULL para a tabela chamados';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao configurar REPLICA IDENTITY: %', SQLERRM;
END
$$;