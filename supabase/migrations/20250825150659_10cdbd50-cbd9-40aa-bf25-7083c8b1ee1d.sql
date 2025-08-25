-- Primeira parte: criar enum temporário e migrar dados
CREATE TYPE temp_app_role AS ENUM ('admin', 'diretoria', 'supervisor', 'colaborador', 'diretor', 'gestor_equipe', 'gestor_unidade', 'franqueado', 'auditor_juridico', 'gerente');

-- Atualizar user_roles usando o enum temporário
UPDATE public.user_roles 
SET role = 'supervisor'::temp_app_role::text::app_role
WHERE role::text = 'gerente';

-- Atualizar escalation_levels se houver
UPDATE public.escalation_levels 
SET role = 'supervisor'::temp_app_role::text::app_role
WHERE role::text = 'gerente';

-- Atualizar role_permissions se houver
UPDATE public.role_permissions 
SET role = 'supervisor'::temp_app_role::text::app_role
WHERE role::text = 'gerente';

-- Remover enum temporário
DROP TYPE temp_app_role;

-- Log da correção
INSERT INTO public.logs_de_sistema (
    tipo_log,
    entidade_afetada,
    entidade_id,
    acao_realizada,
    dados_novos
) VALUES (
    'sistema'::public.log_tipo,
    'user_roles',
    'data_migration',
    'Migração de dados: gerente -> supervisor concluída',
    jsonb_build_object('timestamp', now(), 'action', 'role_migration')
);