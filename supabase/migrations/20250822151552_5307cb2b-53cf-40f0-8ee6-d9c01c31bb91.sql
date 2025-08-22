-- Corrigir prioridades inválidas nos tickets existentes
UPDATE tickets 
SET prioridade = 'imediato'::ticket_prioridade 
WHERE prioridade::text = 'urgente';

UPDATE tickets 
SET prioridade = 'ate_1_hora'::ticket_prioridade 
WHERE prioridade::text = 'alta';

UPDATE tickets 
SET prioridade = 'ainda_hoje'::ticket_prioridade 
WHERE prioridade::text = 'hoje_18h';

UPDATE tickets 
SET prioridade = 'posso_esperar'::ticket_prioridade 
WHERE prioridade::text = 'padrao_24h';

-- Ativar crise para tickets do girabot
DO $$
DECLARE
    crisis_id UUID;
    ticket_count INTEGER;
    first_ticket_id UUID;
BEGIN
    -- Contar tickets do girabot das últimas 2 horas
    SELECT COUNT(*) INTO ticket_count
    FROM tickets t
    WHERE t.data_abertura >= NOW() - INTERVAL '2 hours'
    AND LOWER(t.descricao_problema) LIKE '%girabot%'
    AND t.status != 'concluido';
    
    -- Se há tickets suficientes, criar crise
    IF ticket_count >= 3 THEN
        -- Pegar o primeiro ticket para base da crise
        SELECT t.id INTO first_ticket_id
        FROM tickets t
        WHERE t.data_abertura >= NOW() - INTERVAL '2 hours'
        AND LOWER(t.descricao_problema) LIKE '%girabot%'
        AND t.status != 'concluido'
        ORDER BY t.data_abertura ASC
        LIMIT 1;
        
        -- Ativar crise
        SELECT public.activate_crisis(
            first_ticket_id,
            'Crise detectada automaticamente: ' || ticket_count || ' tickets sobre problemas no girabot',
            '92d526f8-c52d-46e8-9b9d-161370dabce2'::uuid,
            ARRAY['a9af7dfc-c210-4a52-bb60-065c5dc1f40e']
        ) INTO crisis_id;
        
        RAISE NOTICE 'Crise criada: % para % tickets do girabot', crisis_id, ticket_count;
    END IF;
END $$;