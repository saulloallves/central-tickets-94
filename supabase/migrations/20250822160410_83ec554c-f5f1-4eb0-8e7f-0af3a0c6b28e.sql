-- Migração simplificada para vincular crises_ativas ao novo sistema

-- 1. Para cada crise_ativa que não tem vinculação, criar uma crise e vincular
DO $$
DECLARE
    crisis_record RECORD;
    new_crisis_id UUID;
    ticket_code TEXT;
BEGIN
    FOR crisis_record IN 
        SELECT ca.*, t.codigo_ticket
        FROM public.crises_ativas ca
        JOIN public.tickets t ON t.id = ca.ticket_id
        LEFT JOIN public.crise_ticket_links ctl ON ca.ticket_id = ctl.ticket_id
        WHERE ctl.ticket_id IS NULL
    LOOP
        -- Criar nova crise para cada crise_ativa não vinculada
        INSERT INTO public.crises (
            titulo, 
            descricao, 
            status, 
            created_at, 
            updated_at, 
            ultima_atualizacao,
            abriu_por
        ) VALUES (
            COALESCE(crisis_record.motivo, 'Crise: ' || crisis_record.codigo_ticket),
            'Crise migrada do sistema anterior para ticket ' || crisis_record.codigo_ticket,
            CASE 
                WHEN crisis_record.resolvida_em IS NULL THEN 'aberto'::public.crise_status
                ELSE 'encerrado'::public.crise_status
            END,
            crisis_record.criada_em,
            COALESCE(crisis_record.resolvida_em, NOW()),
            COALESCE(crisis_record.resolvida_em, NOW()),
            crisis_record.criada_por
        ) RETURNING id INTO new_crisis_id;
        
        -- Vincular o ticket à nova crise
        INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
        VALUES (new_crisis_id, crisis_record.ticket_id, crisis_record.criada_por);
        
        -- Adicionar update à crise
        INSERT INTO public.crise_updates (crise_id, tipo, status, mensagem, created_by, created_at)
        VALUES (
            new_crisis_id,
            'info',
            CASE 
                WHEN crisis_record.resolvida_em IS NULL THEN 'aberto'::public.crise_status
                ELSE 'encerrado'::public.crise_status
            END,
            'Crise migrada automaticamente do sistema anterior',
            crisis_record.criada_por,
            crisis_record.criada_em
        );
        
        RAISE NOTICE 'Migrada crise % para ticket %', new_crisis_id, crisis_record.codigo_ticket;
    END LOOP;
END
$$;