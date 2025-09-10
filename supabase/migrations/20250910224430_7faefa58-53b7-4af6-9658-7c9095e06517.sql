-- Remover funções que ainda referenciam activate_crisis (que foi removida)
DROP FUNCTION IF EXISTS public.detect_and_activate_crisis_v2() CASCADE;
DROP FUNCTION IF EXISTS public.process_existing_girabot_crisis() CASCADE;

-- Remover triggers relacionados
DROP TRIGGER IF EXISTS detect_crisis_v2_trigger ON public.tickets;

-- Verificar se ainda existem outras referências
DROP FUNCTION IF EXISTS public.detect_girabot_crisis() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_girabot_crisis_check() CASCADE;