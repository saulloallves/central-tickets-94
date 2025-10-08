-- Remover constraint antiga
ALTER TABLE public.internal_notifications 
DROP CONSTRAINT IF EXISTS internal_notifications_type_check;

-- Criar nova constraint com todos os tipos necessários
ALTER TABLE public.internal_notifications 
ADD CONSTRAINT internal_notifications_type_check 
CHECK (type = ANY (ARRAY[
  'ticket'::text,
  'ticket_created'::text,
  'ticket_assigned'::text,
  'ticket_forwarded'::text,
  'sla'::text,
  'sla_breach'::text,
  'sla_half'::text,
  'alert'::text,
  'info'::text,
  'crisis'::text,
  'crisis_update'::text,
  'crisis_resolved'::text,
  'franqueado_respondeu'::text,
  'internal_access_request'::text
]));