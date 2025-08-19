-- Update RLS policies to use the new team-aware functions
DROP POLICY IF EXISTS "Users can view tickets they have access to" ON public.tickets;
DROP POLICY IF EXISTS "Gerentes can manage tickets in their units" ON public.tickets;
DROP POLICY IF EXISTS "Creators can update their own tickets (basic)" ON public.tickets;

-- Recreate policies with team support
CREATE POLICY "Users can view tickets they have access to" 
ON public.tickets 
FOR SELECT 
USING (can_view_ticket(unidade_id, equipe_responsavel_id));

CREATE POLICY "Gerentes can manage tickets in their units" 
ON public.tickets 
FOR ALL 
USING (can_update_ticket(unidade_id, equipe_responsavel_id));

CREATE POLICY "Creators can update their own tickets (basic)" 
ON public.tickets 
FOR UPDATE 
USING (auth.uid() = criado_por) 
WITH CHECK (auth.uid() = criado_por);

-- Update other related policies to use team awareness
DROP POLICY IF EXISTS "Users can view messages for tickets they can access" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Users can create messages for tickets they can access" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Gerentes can update messages for tickets in their units" ON public.ticket_mensagens;

CREATE POLICY "Users can view messages for tickets they can access" 
ON public.ticket_mensagens 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.tickets t 
  WHERE t.id = ticket_mensagens.ticket_id 
  AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
));

CREATE POLICY "Users can create messages for tickets they can access" 
ON public.ticket_mensagens 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tickets t 
  WHERE t.id = ticket_mensagens.ticket_id 
  AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
));

CREATE POLICY "Gerentes can update messages for tickets in their units" 
ON public.ticket_mensagens 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.tickets t 
  WHERE t.id = ticket_mensagens.ticket_id 
  AND can_update_ticket(t.unidade_id, t.equipe_responsavel_id)
));