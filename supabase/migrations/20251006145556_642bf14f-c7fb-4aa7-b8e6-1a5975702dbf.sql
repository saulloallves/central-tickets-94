-- Migration to enable CASCADE delete for unidades and clear all related data
-- Complete cleanup: remove all orphaned records first

-- Step 1: Clean ALL orphaned records in related tables

-- Clean atendente_unidades
DELETE FROM public.atendente_unidades 
WHERE id NOT IN (SELECT id FROM public.unidades);

-- Clean chamados
DELETE FROM public.chamados 
WHERE unidade_id NOT IN (SELECT id FROM public.unidades);

-- Clean tickets
DELETE FROM public.tickets 
WHERE unidade_id NOT IN (SELECT id FROM public.unidades);

-- Clean colaboradores (only if unidade_id is not null and doesn't exist)
UPDATE public.colaboradores 
SET unidade_id = NULL 
WHERE unidade_id IS NOT NULL 
AND unidade_id NOT IN (SELECT id FROM public.unidades);

-- Clean escalation_levels if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'escalation_levels' 
        AND column_name = 'unidade_id'
    ) THEN
        DELETE FROM public.escalation_levels 
        WHERE unidade_id IS NOT NULL 
        AND unidade_id NOT IN (SELECT id FROM public.unidades);
    END IF;
END $$;

-- Clean notification_source_config if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_source_config' 
        AND column_name = 'unidade_id'
    ) THEN
        DELETE FROM public.notification_source_config 
        WHERE unidade_id IS NOT NULL 
        AND unidade_id NOT IN (SELECT id FROM public.unidades);
    END IF;
END $$;

-- Step 2: Alter foreign key constraints to CASCADE

-- tickets.unidade_id -> unidades.id
ALTER TABLE public.tickets 
DROP CONSTRAINT IF EXISTS fk_tickets_unidade;

ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_unidade 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;

-- atendente_unidades.id -> unidades.id
ALTER TABLE public.atendente_unidades 
DROP CONSTRAINT IF EXISTS atendente_unidades_id_fkey;

ALTER TABLE public.atendente_unidades 
ADD CONSTRAINT atendente_unidades_id_fkey 
FOREIGN KEY (id) REFERENCES public.unidades(id) ON DELETE CASCADE;

-- colaboradores.unidade_id -> unidades.id (SET NULL)
ALTER TABLE public.colaboradores 
DROP CONSTRAINT IF EXISTS colaboradores_unidade_id_fkey;

ALTER TABLE public.colaboradores 
ADD CONSTRAINT colaboradores_unidade_id_fkey 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE SET NULL;

-- chamados.unidade_id -> unidades.id
ALTER TABLE public.chamados 
DROP CONSTRAINT IF EXISTS chamados_unidade_id_fkey;

ALTER TABLE public.chamados 
ADD CONSTRAINT chamados_unidade_id_fkey 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;

-- escalation_levels (conditional)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'escalation_levels' 
        AND column_name = 'unidade_id'
    ) THEN
        ALTER TABLE public.escalation_levels 
        DROP CONSTRAINT IF EXISTS escalation_levels_unidade_id_fkey;
        
        ALTER TABLE public.escalation_levels 
        ADD CONSTRAINT escalation_levels_unidade_id_fkey 
        FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;
    END IF;
END $$;

-- notification_source_config (conditional)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_source_config' 
        AND column_name = 'unidade_id'
    ) THEN
        ALTER TABLE public.notification_source_config 
        DROP CONSTRAINT IF EXISTS notification_source_config_unidade_id_fkey;
        
        ALTER TABLE public.notification_source_config 
        ADD CONSTRAINT notification_source_config_unidade_id_fkey 
        FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 3: Now safe to delete all unidades (CASCADE will handle the rest)
DELETE FROM public.unidades;

-- Log the cleanup
INSERT INTO public.logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  canal
) VALUES (
  'sistema'::public.log_tipo,
  'unidades',
  'all',
  'Limpeza completa concluída: unidades, tickets, chamados, atendente_unidades e dados órfãos removidos',
  'web'::public.log_canal
);