-- Remover a política que permite acesso irrestrito a todos os tickets
DROP POLICY IF EXISTS "tickets_select_authenticated" ON public.tickets;

-- Verificar se existe uma política similar para INSERT que também pode estar causando problemas
DROP POLICY IF EXISTS "tickets_insert_authenticated" ON public.tickets;