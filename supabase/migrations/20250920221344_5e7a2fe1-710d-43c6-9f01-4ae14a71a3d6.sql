-- Criar tabela para controlar estados dos grupos WhatsApp
CREATE TABLE public.whatsapp_group_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_phone TEXT NOT NULL UNIQUE,
  awaiting_ticket_response BOOLEAN NOT NULL DEFAULT false,
  ticket_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_group_states ENABLE ROW LEVEL SECURITY;

-- Policy para admins e diretoria gerenciarem
CREATE POLICY "Admins and diretoria manage whatsapp_group_states"
ON public.whatsapp_group_states
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Policy para colaboradores visualizarem
CREATE POLICY "Colaboradores view whatsapp_group_states"
ON public.whatsapp_group_states
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'colaborador'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_group_states_updated_at
BEFORE UPDATE ON public.whatsapp_group_states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_whatsapp_group_states_group_phone ON public.whatsapp_group_states(group_phone);
CREATE INDEX idx_whatsapp_group_states_awaiting ON public.whatsapp_group_states(awaiting_ticket_response) WHERE awaiting_ticket_response = true;
CREATE INDEX idx_whatsapp_group_states_expires ON public.whatsapp_group_states(expires_at) WHERE expires_at IS NOT NULL;