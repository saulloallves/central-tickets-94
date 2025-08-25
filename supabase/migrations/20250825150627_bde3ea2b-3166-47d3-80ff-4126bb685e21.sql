-- Corrigir dados existentes que ainda têm 'gerente' nas tabelas
-- Primeiro, precisamos temporariamente permitir o valor 'gerente' no enum

-- Adicionar 'gerente' de volta temporariamente
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gerente';

-- Atualizar todos os registros que têm 'gerente' para 'supervisor'
UPDATE public.user_roles 
SET role = 'supervisor'::app_role 
WHERE role = 'gerente'::app_role;

-- Atualizar tabela escalation_levels se existir referência
UPDATE public.escalation_levels 
SET role = 'supervisor'::app_role 
WHERE role = 'gerente'::app_role;

-- Atualizar qualquer outra tabela que possa ter referência ao enum
UPDATE public.role_permissions 
SET role = 'supervisor'::app_role 
WHERE role = 'gerente'::app_role;

-- Verificar se não há mais nenhum uso do valor 'gerente'
DO $$
DECLARE
    gerente_count INTEGER;
BEGIN
    -- Contar usos restantes de 'gerente'
    SELECT COUNT(*) INTO gerente_count 
    FROM public.user_roles 
    WHERE role = 'gerente'::app_role;
    
    IF gerente_count > 0 THEN
        RAISE NOTICE 'Ainda existem % registros com role gerente na tabela user_roles', gerente_count;
    END IF;
END $$;

-- Log da correção
INSERT INTO public.logs_de_sistema (
    tipo_log,
    entidade_afetada,
    entidade_id,
    acao_realizada,
    usuario_responsavel,
    dados_novos
) VALUES (
    'sistema'::public.log_tipo,
    'user_roles',
    'migration',
    'Corrigidos registros com role gerente para supervisor',
    NULL,
    jsonb_build_object('acao', 'fix_gerente_to_supervisor', 'timestamp', now())
);