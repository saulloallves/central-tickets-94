-- Alterar o campo franqueado_id para aceitar bigint (ID dos franqueados)
ALTER TABLE public.tickets 
ALTER COLUMN franqueado_id TYPE bigint USING franqueado_id::text::bigint;