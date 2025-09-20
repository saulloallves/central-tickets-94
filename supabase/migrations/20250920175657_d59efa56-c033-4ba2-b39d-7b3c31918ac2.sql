-- Buscar todos os triggers na tabela tickets
SELECT trigger_name, routine_name 
FROM information_schema.triggers 
WHERE event_object_table = 'tickets';