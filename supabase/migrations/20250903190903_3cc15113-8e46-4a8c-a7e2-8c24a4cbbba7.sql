-- Criar tabela para mensagens de crise
CREATE TABLE public.crise_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crise_id UUID NOT NULL REFERENCES public.crises(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL,
  enviado_por UUID REFERENCES auth.users(id),
  grupos_destinatarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_grupos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_crise_mensagens_crise_id ON public.crise_mensagens(crise_id);
CREATE INDEX idx_crise_mensagens_created_at ON public.crise_mensagens(created_at DESC);

-- RLS Policies
ALTER TABLE public.crise_mensagens ENABLE ROW LEVEL SECURITY;

-- Admins e diretoria podem gerenciar todas as mensagens
CREATE POLICY "crise_mensagens_admin_diretoria_manage" 
ON public.crise_mensagens
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Usuários podem ver mensagens de crises que têm acesso
CREATE POLICY "crise_mensagens_view_by_access" 
ON public.crise_mensagens
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crises c
    WHERE c.id = crise_mensagens.crise_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'diretoria'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.crise_ticket_links ctl
        JOIN public.tickets t ON t.id = ctl.ticket_id
        WHERE ctl.crise_id = c.id
        AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
      )
    )
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_crise_mensagens_updated_at
  BEFORE UPDATE ON public.crise_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();