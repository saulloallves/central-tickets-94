-- Create enum for AI interaction types
CREATE TYPE public.ai_interaction_kind AS ENUM ('suggestion', 'chat');

-- Create unified table for AI interactions
CREATE TABLE public.ticket_ai_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  kind ai_interaction_kind NOT NULL,
  user_id UUID NULL,
  mensagem TEXT NULL,
  resposta TEXT NOT NULL,
  foi_usada BOOLEAN DEFAULT false,
  resposta_final TEXT NULL,
  used_by UUID NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  model TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  log JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_ticket_ai_interactions_ticket_id ON public.ticket_ai_interactions (ticket_id);
CREATE INDEX idx_ticket_ai_interactions_created_at ON public.ticket_ai_interactions (created_at);

-- Enable RLS
ALTER TABLE public.ticket_ai_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all ticket_ai_interactions" 
ON public.ticket_ai_interactions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view AI interactions for accessible tickets" 
ON public.ticket_ai_interactions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM tickets t 
  WHERE t.id = ticket_ai_interactions.ticket_id 
  AND can_view_ticket(t.unidade_id)
));

CREATE POLICY "Users can create AI interactions for accessible tickets" 
ON public.ticket_ai_interactions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM tickets t 
  WHERE t.id = ticket_ai_interactions.ticket_id 
  AND can_view_ticket(t.unidade_id)
));

CREATE POLICY "Users can update AI interactions for manageable tickets" 
ON public.ticket_ai_interactions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM tickets t 
  WHERE t.id = ticket_ai_interactions.ticket_id 
  AND can_update_ticket(t.unidade_id)
));

-- Extend faq_ai_settings with new columns
ALTER TABLE public.faq_ai_settings 
ADD COLUMN modelo_sugestao TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN modelo_chat TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN estilo_resposta TEXT DEFAULT 'Direto';

-- Add audit trigger
CREATE TRIGGER audit_ticket_ai_interactions
AFTER INSERT OR UPDATE OR DELETE ON public.ticket_ai_interactions
FOR EACH ROW EXECUTE FUNCTION audit_trigger();