-- Remover funções duplicadas de get_realtime_kpis para resolver conflito
DROP FUNCTION IF EXISTS public.get_realtime_kpis(p_user_id uuid, p_unidade_filter text, p_equipe_filter text, p_periodo_dias integer);

-- Manter apenas a versão que aceita equipe_filter como UUID
-- Essa versão já existe e é a correta