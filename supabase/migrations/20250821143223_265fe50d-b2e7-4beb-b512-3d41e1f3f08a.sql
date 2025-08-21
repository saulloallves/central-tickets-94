-- Ensure transition from aberto to escalonado is allowed
INSERT INTO public.ticket_status_transitions (from_status, to_status, allowed, reason)
VALUES ('aberto', 'escalonado', true, 'Escalar sem atendimento')
ON CONFLICT (from_status, to_status) DO UPDATE 
SET allowed = true, reason = 'Escalar sem atendimento';

-- Ensure transition from em_atendimento to escalonado is allowed  
INSERT INTO public.ticket_status_transitions (from_status, to_status, allowed, reason)
VALUES ('em_atendimento', 'escalonado', true, 'Escalar durante atendimento')
ON CONFLICT (from_status, to_status) DO UPDATE 
SET allowed = true, reason = 'Escalar durante atendimento';