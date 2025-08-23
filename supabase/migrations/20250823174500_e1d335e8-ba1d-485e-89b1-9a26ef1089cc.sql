-- Backfill tickets with UUID codigo_ticket to use proper sequential codes
UPDATE public.tickets 
SET codigo_ticket = next_ticket_code(unidade_id)
WHERE codigo_ticket ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';