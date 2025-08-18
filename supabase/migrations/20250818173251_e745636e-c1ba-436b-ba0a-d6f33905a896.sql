-- Adicionar todas as foreign keys necessárias para integridade referencial

-- 1. Tickets table foreign keys
ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_unidade 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE RESTRICT;

ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_franqueado 
FOREIGN KEY (franqueado_id) REFERENCES public.franqueados(Id) ON DELETE SET NULL;

ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_colaborador 
FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE SET NULL;

ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_criado_por 
FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_escalonado_para 
FOREIGN KEY (escalonado_para) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Ticket mensagens foreign keys
ALTER TABLE public.ticket_mensagens 
ADD CONSTRAINT fk_ticket_mensagens_ticket 
FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_mensagens 
ADD CONSTRAINT fk_ticket_mensagens_usuario 
FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Colaboradores foreign keys
ALTER TABLE public.colaboradores 
ADD CONSTRAINT fk_colaboradores_unidade 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE SET NULL;

-- 4. Escalation levels foreign keys
ALTER TABLE public.escalation_levels 
ADD CONSTRAINT fk_escalation_levels_unidade 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;

ALTER TABLE public.escalation_levels 
ADD CONSTRAINT fk_escalation_levels_destino_user 
FOREIGN KEY (destino_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. Escalation logs foreign keys
ALTER TABLE public.escalation_logs 
ADD CONSTRAINT fk_escalation_logs_ticket 
FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

ALTER TABLE public.escalation_logs 
ADD CONSTRAINT fk_escalation_logs_to_user 
FOREIGN KEY (to_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Notifications queue foreign keys
ALTER TABLE public.notifications_queue 
ADD CONSTRAINT fk_notifications_queue_ticket 
FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

-- 7. Ticket sequences foreign keys
ALTER TABLE public.ticket_sequences 
ADD CONSTRAINT fk_ticket_sequences_unidade 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;

-- 8. User roles foreign keys
ALTER TABLE public.user_roles 
ADD CONSTRAINT fk_user_roles_user 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;